package instance

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/txn2/txeh"

	"go.opentelemetry.io/otel/trace"
)

type Instance struct {
	EnvID string

	Files *InstanceFiles
	Slot  *IPSlot
	FC    *FC

	config *InstanceConfig
}

type InstanceConfig struct {
	EnvID                 string
	AllocID               string
	NodeID                string
	ConsulToken           string
	EnvsDisk              string
	InstanceID            string
	LogsProxyAddress      string
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

func NewInstance(
	ctx context.Context,
	tracer trace.Tracer,
	config *InstanceConfig,
	hosts *txeh.Hosts,
) (*Instance, error) {
	childCtx, childSpan := tracer.Start(ctx, "new-instance")
	defer childSpan.End()

	// Get slot from Consul KV
	ips, err := NewSlot(
		childCtx,
		tracer,
		config.NodeID,
		config.InstanceID,
		config.ConsulToken,
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to get IP slot: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "reserved ip slot")

	defer func() {
		if err != nil {
			slotErr := ips.Release(childCtx, tracer)
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
			ntErr := ips.RemoveNetwork(childCtx, tracer, hosts)
			if ntErr != nil {
				errMsg := fmt.Errorf("error removing network namespace after failed instance start: %w", ntErr)
				telemetry.ReportError(childCtx, errMsg)
			} else {
				telemetry.ReportEvent(childCtx, "removed network namespace")
			}
		}
	}()

	err = ips.CreateNetwork(childCtx, tracer, hosts)
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
		config.EnvID,
		config.EnvsDisk,
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

	fc, err := startFC(
		childCtx,
		tracer,
		config.AllocID,
		ips,
		fsEnv,
		&MmdsMetadata{
			InstanceID: config.InstanceID,
			EnvID:      config.EnvID,
			Address:    config.LogsProxyAddress,
			TraceID:    config.TraceID,
			TeamID:     config.TeamID,
		},
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to start FC: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "initialized FC")

	return &Instance{
		EnvID: config.EnvID,
		Files: fsEnv,
		Slot:  ips,
		FC:    fc,

		config: config,
	}, nil
}

func (i *Instance) CleanupAfterFCStop(
	ctx context.Context,
	tracer trace.Tracer,
	hosts *txeh.Hosts,
) {
	childCtx, childSpan := tracer.Start(ctx, "delete-instance")
	defer childSpan.End()

	err := i.Slot.RemoveNetwork(childCtx, tracer, hosts)
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

	err = i.Slot.Release(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("failed to release slot: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "released slot")
	}
}
