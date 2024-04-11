package sandbox

import (
	"context"
	"fmt"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	consul "github.com/hashicorp/consul/api"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/e2b-dev/infra/packages/shared/pkg/consts"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"go.opentelemetry.io/otel/trace"
)

var logsProxyAddress = os.Getenv("LOGS_PROXY_ADDRESS")

type Sandbox struct {
	Files *InstanceFiles
	Slot  *IPSlot
	FC    *FC

	Info *orchestrator.SandboxDetail

	config *InstanceConfig

	TemplateID string
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

func New(
	ctx context.Context,
	tracer trace.Tracer,
	consul *consul.Client,
	config *InstanceConfig,
	dns *DNS,
	sandboxRequest *orchestrator.SandboxCreateRequest,
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

	fsEnv, err := newInstanceFiles(
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
		TemplateID: config.TemplateID,
		Files:      fsEnv,
		Slot:       ips,
		FC:         fc,

		Info: &orchestrator.SandboxDetail{
			SandboxID:         config.SandboxID,
			TemplateID:        config.TemplateID,
			BuildID:           sandboxRequest.BuildID,
			TeamID:            config.TeamID,
			Metadata:          sandboxRequest.Metadata,
			Alias:             sandboxRequest.Alias,
			MaxInstanceLength: sandboxRequest.MaxInstanceLength,
		},
		config: config,
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

	return instance, nil
}

func (i *Sandbox) syncClock(ctx context.Context) error {
	address := fmt.Sprintf("http://%s:%d/sync", i.Slot.HostSnapshotIP(), consts.DefaultEnvdServerPort)

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

func (i *Sandbox) EnsureClockSync(ctx context.Context) error {
syncLoop:
	for {
		select {
		case <-time.After(10 * time.Second):
		case <-ctx.Done():
			return ctx.Err()
		default:
			err := i.syncClock(ctx)
			if err != nil {
				telemetry.ReportError(ctx, fmt.Errorf("error syncing clock: %w", err))
				continue
			}
			break syncLoop
		}
	}

	return nil
}

func (i *Sandbox) CleanupAfterFCStop(
	ctx context.Context,
	tracer trace.Tracer,
	consul *consul.Client,
	dns *DNS,
) {
	childCtx, childSpan := tracer.Start(ctx, "delete-instance")
	defer childSpan.End()

	err := i.Slot.RemoveNetwork(childCtx, tracer, dns)
	if err != nil {
		errMsg := fmt.Errorf("cannot remove network when destroying task: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "removed network")
	}

	err = i.Files.Cleanup(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("failed to delete instance files: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "deleted instance files")
	}

	err = i.Slot.Release(childCtx, tracer, consul)
	if err != nil {
		errMsg := fmt.Errorf("failed to release slot: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "released slot")
	}
}
