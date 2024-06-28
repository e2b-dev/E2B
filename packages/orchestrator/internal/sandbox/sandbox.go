package sandbox

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/pool"
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

	waitForUffd       = 80 * time.Millisecond
	uffdCheckInterval = 10 * time.Millisecond
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
	networkPool *pool.Pool[*IPSlot],
	config *orchestrator.SandboxConfig,
	traceID string,
) (*Sandbox, error) {
	childCtx, childSpan := tracer.Start(ctx, "new-sandbox")
	defer childSpan.End()

	_, networkSpan := tracer.Start(ctx, "get-network-slot")
	// Get slot from Consul KV
	ips := networkPool.Get()
	telemetry.ReportEvent(childCtx, "reserved ip slot")
	networkSpan.End()

	_, dnsSpan := tracer.Start(ctx, "setup-dns")
	err := dns.Add(ips, config.SandboxID)
	if err != nil {
		errMsg := fmt.Errorf("failed to add DNS record: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "added DNS record")
	dnsSpan.End()

	defer func() {
		if err != nil {
			err := dns.Remove(config.SandboxID)
			if err != nil {
				errMsg := fmt.Errorf("error removing env instance to etc hosts: %w", err)
				telemetry.ReportCriticalError(childCtx, errMsg)
			} else {
				telemetry.ReportEvent(childCtx, "removed env instance to etc hosts")
			}
		}
	}()

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
			ntErr := ips.RemoveNetwork(childCtx, tracer)
			if ntErr != nil {
				errMsg := fmt.Errorf("error removing network namespace after failed instance start: %w", ntErr)
				telemetry.ReportError(childCtx, errMsg)
			} else {
				telemetry.ReportEvent(childCtx, "removed network namespace")
			}
		}
	}()

	fsEnv, err := newSandboxFiles(
		childCtx,
		tracer,
		config.SandboxID,
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
			case <-time.After(waitForUffd):
				fmt.Printf("waiting for uffd to initialize")
				return nil, fmt.Errorf("timeout waiting to uffd to initialize")
			case <-childCtx.Done():
				return nil, childCtx.Err()
			default:
				isRunning, _ := checkIsRunning(uffd.cmd.Process)
				fmt.Printf("uffd is running: %v", isRunning)
				if isRunning {
					break uffdWait
				}

				time.Sleep(uffdCheckInterval)
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
	sandboxID string,
) {
	childCtx, childSpan := tracer.Start(ctx, "delete-instance")
	defer childSpan.End()

	err := s.slot.RemoveNetwork(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("cannot remove network when destroying task: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "removed network")
	}

	err = dns.Remove(sandboxID)
	if err != nil {
		errMsg := fmt.Errorf("error removing env instance to etc hosts: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "removed env instance to etc hosts")
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
	defer s.Stop(ctx, tracer)

	if s.uffd != nil {
		go func() {
			err := s.uffd.wait()
			fmt.Printf("uffd wait error: %v", err)
		}()
	}

	return s.fc.wait()
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
