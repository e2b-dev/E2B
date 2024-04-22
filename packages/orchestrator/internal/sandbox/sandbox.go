package sandbox

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/consts"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	consul "github.com/hashicorp/consul/api"
)

const (
	fcVersionsDir  = "/fc-versions"
	kernelsDir     = "/fc-kernels"
	kernelMountDir = "/fc-vm"
	kernelName     = "vmlinux.bin"
	uffdBinaryName = "uffd"
	fcBinaryName   = "firecracker"

	WaitForUffd       = 80 * time.Millisecond
	UffdCheckInterval = 10 * time.Millisecond
)

var logsProxyAddress = os.Getenv("LOGS_PROXY_ADDRESS")

var httpClient = http.Client{
	Timeout: 5 * time.Second,
}

type Sandbox struct {
	slot  *IPSlot
	files *SandboxFiles

	fc   *fc
	uffd *uffd

	Sandbox   *orchestrator.SandboxConfig
	StartedAt time.Time
	TraceID   string
}

// This method should recover the sandbox based on slot idx and pids for uffd and fc
func RecoverSandbox(
	ctx context.Context,
	tracer trace.Tracer,
	consul *consul.Client,
	dns *DNS,
	config *orchestrator.SandboxConfig,
	traceID string,
	slotIdx,
	fcPid int,
	uffdPid *int,
	startedAt time.Time,
) (*Sandbox, error) {
	ips := RecoverSlot(config.SandboxID, slotIdx)

	fsEnv, err := newSandboxFiles(
		ctx,
		tracer,
		ips,
		config.TemplateID,
		config.KernelVersion,
		kernelsDir,
		kernelMountDir,
		kernelName,
		fcBinaryPath(config.FirecrackerVersion),
		uffdBinaryPath(config.FirecrackerVersion),
		config.HugePages,
	)
	if err != nil {
		return nil, err
	}

	var uffd *uffd
	if fsEnv.UFFDSocketPath != nil && uffdPid != nil {
		uffd = newUFFD(fsEnv)
		uffdErr := uffd.recover(*uffdPid)
		if uffdErr != nil {
			errMsg := fmt.Errorf("failed to recover UFFD: %w", uffdErr)
			telemetry.ReportCriticalError(ctx, errMsg)

			return nil, errMsg
		}
	}

	fc := newFC(
		ctx,
		tracer,
		ips,
		fsEnv,
		&MmdsMetadata{
			InstanceID: config.SandboxID,
			EnvID:      config.TemplateID,
			Address:    logsProxyAddress,
			TraceID:    traceID,
			TeamID:     config.TeamID,
		},
	)

	err = fc.recover(fcPid)
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

		StartedAt: startedAt,
		Sandbox:   config,
		TraceID:   traceID,
	}, nil
}

func uffdBinaryPath(fcVersion string) string {
	return filepath.Join(fcVersionsDir, fcVersion, uffdBinaryName)
}

func fcBinaryPath(fcVersion string) string {
	return filepath.Join(fcVersionsDir, fcVersion, fcBinaryName)
}

func NewSandbox(
	ctx context.Context,
	tracer trace.Tracer,
	consul *consul.Client,
	dns *DNS,
	config *orchestrator.SandboxConfig,
	traceID string,
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
		kernelsDir,
		kernelMountDir,
		kernelName,
		fcBinaryPath(config.FirecrackerVersion),
		uffdBinaryPath(config.FirecrackerVersion),
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

	var uffd *uffd
	if fsEnv.UFFDSocketPath != nil {
		uffd = newUFFD(fsEnv)

		uffdErr := uffd.start()
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

	fc := newFC(
		childCtx,
		tracer,
		ips,
		fsEnv,
		&MmdsMetadata{
			InstanceID: config.SandboxID,
			EnvID:      config.TemplateID,
			Address:    logsProxyAddress,
			TraceID:    traceID,
			TeamID:     config.TeamID,
		},
	)

	err = fc.start(childCtx, tracer)
	if err != nil {
		if uffd != nil {
			uffd.stop(childCtx, tracer)
		}

		errMsg := fmt.Errorf("failed to start FC: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "initialized FC")

	instance := &Sandbox{
		files: fsEnv,
		slot:  ips,
		fc:    fc,
		uffd:  uffd,

		Sandbox: config,
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

func (s *Sandbox) waitWithUffd(ctx context.Context, tracer trace.Tracer) error {
	fcChan := make(chan error)
	uffdChan := make(chan error)

	var wg sync.WaitGroup

	wg.Add(1)

	go func() {
		defer wg.Done()
		fcChan <- s.fc.wait()
		close(fcChan)
	}()

	wg.Add(1)

	go func() {
		defer wg.Done()
		uffdChan <- s.uffd.wait()
		close(uffdChan)
	}()

	select {
	case <-ctx.Done():
		s.Stop(ctx, tracer)

		return ctx.Err()
	case err := <-fcChan:
		s.Stop(ctx, tracer)

		if err != nil {
			return err
		}
	case err := <-uffdChan:
		s.Stop(ctx, tracer)

		if err != nil {
			return err
		}
	}

	wg.Wait()

	return nil
}

func (s *Sandbox) waitNoUffd(_ context.Context, _ trace.Tracer) error {
	return s.fc.wait()
}

func (s *Sandbox) Wait(ctx context.Context, tracer trace.Tracer) (err error) {
	if s.uffd != nil {
		return s.waitWithUffd(ctx, tracer)
	}

	return s.waitNoUffd(ctx, tracer)
}

func (s *Sandbox) Stop(ctx context.Context, tracer trace.Tracer) {
	childCtx, childSpan := tracer.Start(ctx, "stop-sandbox", trace.WithAttributes())
	defer childSpan.End()

	s.fc.stop(childCtx, tracer)

	if s.uffd != nil {
		// Wait until we stop uffd if it exists
		time.Sleep(1 * time.Second)

		s.uffd.stop(childCtx, tracer)
	}
}

func (s *Sandbox) SlotIdx() int {
	return s.slot.SlotIdx
}

func (s *Sandbox) FcPid() int {
	return s.fc.pid
}

func (s *Sandbox) UffdPid() *int {
	if s.uffd == nil {
		return nil
	}

	return &s.uffd.pid
}
