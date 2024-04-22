package sandbox

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/consts"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	consul "github.com/hashicorp/consul/api"
)

const (
	WaitForUffd       = 80 * time.Millisecond
	UffdCheckInterval = 10 * time.Millisecond
)

var logsProxyAddress = os.Getenv("LOGS_PROXY_ADDRESS")

type Sandbox struct {
	slot  *IPSlot
	files *SandboxFiles

	fc   *FC
	uffd *UFFD

	Sandbox *orchestrator.SandboxConfig

	StartedAt time.Time

	config *InstanceConfig

	templateID string
}

var httpClient = http.Client{
	Timeout: 5 * time.Second,
}

type InstanceConfig struct {
	TemplateID            string
	SandboxID             string
	TraceID               string
	TeamID                string
	KernelVersion         string
	KernelMountDir        string
	KernelsDir            string
	KernelName            string
	FirecrackerBinaryPath string
	UFFDBinaryPath        string
	HugePages             bool
}

// This method should recover the sandbox based on slot idx and pids for uffd and fc
// We are passing all the parameters right now, but it is possible that they do have a overlap
func RecoverSandbox(
	ctx context.Context,
	tracer trace.Tracer,
	instanceID string,
	slotIdx int,
	consul *consul.Client,
	config *InstanceConfig,
	dns *DNS,
	startedAt time.Time,
	fcPid int,
	uffdPid *int,
	sandboxConfig *orchestrator.SandboxConfig,
) (*Sandbox, error) {
	ips := RecoverSlot(instanceID, slotIdx)

	fsEnv, err := newSandboxFiles(
		ctx,
		tracer,
		ips,
		config.TemplateID,
		config.KernelVersion,
		config.KernelsDir,
		config.KernelMountDir,
		config.KernelName,
		config.FirecrackerBinaryPath,
		config.UFFDBinaryPath,
		config.HugePages,
	)
	if err != nil {
		return nil, err
	}

	var uffd *UFFD
	if fsEnv.UFFDSocketPath != nil && uffdPid != nil {
		uffd = NewUFFD(fsEnv)
		uffdErr := uffd.Recover(*uffdPid)
		if uffdErr != nil {
			errMsg := fmt.Errorf("failed to recover UFFD: %w", uffdErr)
			telemetry.ReportCriticalError(ctx, errMsg)

			return nil, errMsg
		}
	}

	fc := NewFC(
		ctx,
		tracer,
		ips,
		fsEnv,
		&MmdsMetadata{
			InstanceID: config.SandboxID,
			EnvID:      config.TemplateID,
			Address:    logsProxyAddress,
			TraceID:    config.TraceID,
			TeamID:     config.TeamID,
		},
	)

	err = fc.Recover(fcPid)
	if err != nil {
		errMsg := fmt.Errorf("failed to recover FC: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return nil, errMsg
	}

	// Use the implemented Recovery methods from slot, uffd, fc + finish the recovery/Ensure method for sandboxFiles

	// After returning the sandbox ensure that we start a goroutine that cleans up resources after the .Wait finishes, the same we have for when starting the sandbox.
	return &Sandbox{
		slot:  ips,
		files: fsEnv,
		uffd:  uffd,
		fc:    fc,

		StartedAt:  startedAt,
		templateID: config.TemplateID,
		config:     config,
		Sandbox:    sandboxConfig,
	}, nil
}

func NewSandbox(
	ctx context.Context,
	tracer trace.Tracer,
	consul *consul.Client,
	config *InstanceConfig,
	dns *DNS,
	sandboxConfig *orchestrator.SandboxConfig,
) (*Sandbox, error) {
	childCtx, childSpan := tracer.Start(ctx, "new-sandbox")
	defer childSpan.End()

	// Get slot from Consul KV
	ips, err := NewSlot(
		childCtx,
		tracer,
		consul,
		config.SandboxID,
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to get IP slot: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "reserved ip slot")

	defer func() {
		if err != nil {
			slotErr := ips.Release(childCtx, tracer, consul)
			if slotErr != nil {
				errMsg := fmt.Errorf("error removing network namespace after failed instance start: %w", slotErr)
				telemetry.ReportError(childCtx, errMsg)
			} else {
				telemetry.ReportEvent(childCtx, "released ip slot")
			}
		}
	}()

	defer func() {
		if err != nil {
			ntErr := ips.RemoveNetwork(childCtx, tracer, dns)
			if ntErr != nil {
				errMsg := fmt.Errorf("error removing network namespace after failed instance start: %w", ntErr)
				telemetry.ReportError(childCtx, errMsg)
			} else {
				telemetry.ReportEvent(childCtx, "removed network namespace")
			}
		}
	}()

	err = ips.CreateNetwork(childCtx, tracer, dns)
	if err != nil {
		errMsg := fmt.Errorf("failed to create namespaces: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "created network")

	fsEnv, err := newSandboxFiles(
		childCtx,
		tracer,
		ips,
		config.TemplateID,
		config.KernelVersion,
		config.KernelsDir,
		config.KernelMountDir,
		config.KernelName,
		config.FirecrackerBinaryPath,
		config.UFFDBinaryPath,
		config.HugePages,
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to assemble env files info for FC: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "assembled env files info")

	err = fsEnv.Ensure(childCtx)
	if err != nil {
		errMsg := fmt.Errorf("failed to create env for FC: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "created env for FC")

	defer func() {
		if err != nil {
			envErr := fsEnv.Cleanup(childCtx, tracer)
			if envErr != nil {
				errMsg := fmt.Errorf("error deleting env after failed fc start: %w", err)
				telemetry.ReportCriticalError(childCtx, errMsg)
			} else {
				telemetry.ReportEvent(childCtx, "deleted env")
			}
		}
	}()

	var uffd *UFFD
	if fsEnv.UFFDSocketPath != nil {
		uffd = NewUFFD(fsEnv)

		uffdErr := uffd.Start()
		if err != nil {
			errMsg := fmt.Errorf("failed to start uffd: %w", uffdErr)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return nil, errMsg
		}

		// Wait for uffd to initialize — it should be possible to handle this better?
	uffdWait:
		for {
			select {
			case <-time.After(WaitForUffd):
				fmt.Printf("waiting for uffd to initialize")
				return nil, fmt.Errorf("timeout waiting to uffd to initialize")
			case <-childCtx.Done():
				return nil, childCtx.Err()
			default:
				isRunning, _ := checkIsRunning(uffd.process)
				fmt.Printf("uffd is running: %v", isRunning)
				if isRunning {
					break uffdWait
				}

				time.Sleep(UffdCheckInterval)
			}
		}
	}

	fc := NewFC(
		childCtx,
		tracer,
		ips,
		fsEnv,
		&MmdsMetadata{
			InstanceID: config.SandboxID,
			EnvID:      config.TemplateID,
			Address:    logsProxyAddress,
			TraceID:    config.TraceID,
			TeamID:     config.TeamID,
		},
	)

	err = fc.Start(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("failed to start FC: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "initialized FC")

	instance := &Sandbox{
		templateID: config.TemplateID,
		files:      fsEnv,
		slot:       ips,
		fc:         fc,
		uffd:       uffd,

		Sandbox: sandboxConfig,
		config:  config,
	}

	telemetry.ReportEvent(childCtx, "ensuring clock sync")
	go func() {
		backgroundCtx := context.Background()

		clockErr := instance.EnsureClockSync(backgroundCtx)
		if clockErr != nil {
			telemetry.ReportError(backgroundCtx, fmt.Errorf("failed to sync clock: %w", clockErr))
		} else {
			telemetry.ReportEvent(backgroundCtx, "clock synced")
		}
	}()

	instance.StartedAt = time.Now()

	return instance, nil
}

func (s *Sandbox) syncClock(ctx context.Context) error {
	address := fmt.Sprintf("http://%s:%d/sync", s.slot.HostSnapshotIP(), consts.DefaultEnvdServerPort)

	request, err := http.NewRequestWithContext(ctx, "POST", address, nil)
	if err != nil {
		return err
	}

	response, err := httpClient.Do(request)
	if err != nil {
		return err
	}

	if _, err := io.Copy(io.Discard, response.Body); err != nil {
		return err
	}

	defer response.Body.Close()

	return nil
}

func (s *Sandbox) EnsureClockSync(ctx context.Context) error {
syncLoop:
	for {
		select {
		case <-time.After(10 * time.Second):
		case <-ctx.Done():
			return ctx.Err()
		default:
			err := s.syncClock(ctx)
			if err != nil {
				telemetry.ReportError(ctx, fmt.Errorf("error syncing clock: %w", err))
				continue
			}
			break syncLoop
		}
	}

	return nil
}

func (s *Sandbox) CleanupAfterFCStop(
	ctx context.Context,
	tracer trace.Tracer,
	consul *consul.Client,
	dns *DNS,
) {
	childCtx, childSpan := tracer.Start(ctx, "delete-instance")
	defer childSpan.End()

	err := s.slot.RemoveNetwork(childCtx, tracer, dns)
	if err != nil {
		errMsg := fmt.Errorf("cannot remove network when destroying task: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "removed network")
	}

	err = s.files.Cleanup(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("failed to delete instance files: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "deleted instance files")
	}

	err = s.slot.Release(childCtx, tracer, consul)
	if err != nil {
		errMsg := fmt.Errorf("failed to release slot: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "released slot")
	}
}

func (s *Sandbox) Wait(ctx context.Context, tracer trace.Tracer) (err error) {
	fcChan := make(chan error)
	uffdChan := make(chan error)

	// var wg sync.WaitGroup

	// wg.Add(1)
	go func() {
		fcChan <- s.fc.Wait()
		close(fcChan)
	}()

	if s.uffd != nil {
		// wg.Add(1)
		go func() {
			uffdChan <- s.uffd.Wait()
			close(uffdChan)
		}()
	} else {
		uffdChan <- nil
		close(uffdChan)
	}

	if s.uffd != nil {
		select {
		case err = <-fcChan:
			s.Stop(ctx, tracer)
		case err = <-uffdChan:
			s.Stop(ctx, tracer)
		}
	} else {
		return <-fcChan
	}

	// select {
	// case wg.Done():
	// 	return nil
	// case <-ctx.Done():
	// 	return ctx.Err()
	// }
	// Wait for both channel close OR context cancel

	return err
}

func (s *Sandbox) Stop(ctx context.Context, tracer trace.Tracer) {
	childCtx, childSpan := tracer.Start(ctx, "stop-sandbox", trace.WithAttributes())
	defer childSpan.End()

	s.fc.Stop(childCtx, tracer)

	if s.uffd != nil {
		// Wait until we stop uffd if it exists
		time.Sleep(1 * time.Second)

		s.uffd.Stop(childCtx, tracer)
	}
}
