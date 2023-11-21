package internal

import (
	"context"
	"fmt"
	"time"

	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/instance"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const taskHandleVersion = 1

type (
	TaskConfig struct {
		InstanceID string `codec:"InstanceID"`
		EnvID      string `codec:"EnvID"`

		TraceID string `codec:"TraceID"`
		SpanID  string `codec:"SpanID"`

		LogsProxyAddress string `codec:"LogsProxyAddress"`

		ConsulToken string `codec:"ConsulToken"`
	}

	TaskState struct {
		TaskConfig *drivers.TaskConfig
		StartedAt  time.Time
	}
)

var taskConfigSpec = hclspec.NewObject(map[string]*hclspec.Spec{
	"InstanceID": hclspec.NewAttr("InstanceID", "string", true),
	"EnvID":      hclspec.NewAttr("EnvID", "string", true),

	"SpanID":  hclspec.NewAttr("SpanID", "string", true),
	"TraceID": hclspec.NewAttr("TraceID", "string", true),

	"LogsProxyAddress": hclspec.NewAttr("LogsProxyAddress", "string", true),

	"ConsulToken": hclspec.NewAttr("ConsulToken", "string", true),
})

func (d *Driver) StartTask(cfg *drivers.TaskConfig) (*drivers.TaskHandle, *drivers.DriverNetwork, error) {
	ctx, span := d.tracer.Start(d.ctx, "start-env-instance-task-validation", trace.WithAttributes(
		attribute.String("alloc_id", cfg.AllocID),
	))
	defer span.End()

	if _, ok := d.tasks.Get(cfg.ID); ok {
		errMsg := fmt.Errorf("task with ID %q already started", cfg.ID)

		telemetry.ReportCriticalError(ctx, errMsg)
		return nil, nil, errMsg
	}

	var taskConfig TaskConfig
	if err := cfg.DecodeDriverConfig(&taskConfig); err != nil {
		errMsg := fmt.Errorf("failed to decode driver config: %w", err)

		telemetry.ReportCriticalError(ctx, errMsg)
		return nil, nil, errMsg
	}

	childCtx, childSpan := telemetry.GetContextFromRemote(d.ctx, d.tracer, "start-task", taskConfig.SpanID, taskConfig.TraceID)
	defer childSpan.End()

	childSpan.SetAttributes(
		attribute.String("alloc_id", cfg.AllocID),
		attribute.String("env_id", taskConfig.EnvID),
		attribute.String("instance_id", taskConfig.InstanceID),
		attribute.String("client_id", cfg.Env["NOMAD_NODE_ID"]),
	)

	d.logger.Info("starting firecracker task", "task_cfg", hclog.Fmt("%+v", taskConfig))

	// Get slot from Consul KV
	ipSlot, err := instance.NewSlot(
		childCtx,
		cfg.Env["NOMAD_NODE_ID"],
		taskConfig.InstanceID,
		taskConfig.ConsulToken,
		d.tracer,
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to get IP slot: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "reserved ip slot")

	defer func() {
		if err != nil {
			slotErr := ipSlot.Release(childCtx, taskConfig.ConsulToken, d.tracer)
			if slotErr != nil {
				errMsg := fmt.Errorf("error removing network namespace after failed instance start %w", slotErr)
				telemetry.ReportError(childCtx, errMsg)
			}
		}
	}()

	defer func() {
		if err != nil {
			ntErr := ipSlot.RemoveNetwork(childCtx, d.tracer, d.hosts)
			if ntErr != nil {
				errMsg := fmt.Errorf("error removing network namespace after failed instance start %w", ntErr)
				telemetry.ReportError(childCtx, errMsg)
			}
		}
	}()

	err = ipSlot.CreateNetwork(childCtx, d.tracer, d.hosts)
	if err != nil {
		errMsg := fmt.Errorf("failed to create namespaces %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "created network")

	fsEnv, err := instance.NewInstanceFiles(
		childCtx,
		d.tracer,
		ipSlot,
		taskConfig.EnvID,
		cfg.Env["ENVS_DISK"],
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to create env for FC %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "created env for FC")

	defer func() {
		if err != nil {
			envErr := fsEnv.Cleanup(childCtx, d.tracer)
			if envErr != nil {
				errMsg := fmt.Errorf("error deleting env after failed fc start %w", err)
				telemetry.ReportCriticalError(childCtx, errMsg)
			}
		}
	}()

	fc, err := d.initializeFC(
		childCtx,
		cfg,
		taskConfig,
		ipSlot,
		fsEnv,
	)
	if err != nil {
		d.logger.Info("Error starting firecracker vm", "driver_cfg", hclog.Fmt("%+v", err))
		errMsg := fmt.Errorf("task with ID %q failed: %q", cfg.ID, err.Error())
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "initialized FC")

	h := &taskHandle{
		ctx:                   childCtx,
		taskConfig:            cfg,
		State:                 drivers.TaskStateRunning,
		startedAt:             time.Now().Round(time.Millisecond),
		MachineInstance:       fc.Machine,
		Slot:                  ipSlot,
		EnvInstanceFilesystem: fsEnv,
		EnvInstance:           fc.Instance,
		ConsulToken:           taskConfig.ConsulToken,
		logger:                d.logger,
	}

	driverState := TaskState{
		TaskConfig: cfg,
		StartedAt:  h.startedAt,
	}

	handle := drivers.NewTaskHandle(taskHandleVersion)
	handle.Config = cfg

	if err = handle.SetDriverState(&driverState); err != nil {
		fc.Machine.StopVMM()
		d.logger.Error("failed to start task, error setting driver state", "error", err)
		errMsg := fmt.Errorf("failed to set driver state: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, nil, errMsg
	}

	d.tasks.Set(cfg.ID, h)

	go h.run(childCtx, d)

	return handle, nil, nil
}

func (d *Driver) WaitTask(ctx context.Context, taskID string) (<-chan *drivers.ExitResult, error) {
	validationCtx, validationSpan := d.tracer.Start(ctx, "wait-env-instance-task-validation", trace.WithAttributes(
		attribute.String("task_id", taskID),
	))
	defer validationSpan.End()

	h, ok := d.tasks.Get(taskID)
	if !ok {
		telemetry.ReportCriticalError(validationCtx, drivers.ErrTaskNotFound)
		return nil, drivers.ErrTaskNotFound
	}

	childCtx, childSpan := d.tracer.Start(d.ctx, "wait-env-instance-task",
		trace.WithAttributes(
			attribute.String("task_id", taskID),
		),
		trace.WithLinks(
			trace.LinkFromContext(validationCtx, attribute.String("link", "validation")),
			trace.LinkFromContext(h.ctx, attribute.String("link", "start-env-instance-task")),
		),
	)
	defer childSpan.End()

	ch := make(chan *drivers.ExitResult)
	go d.handleWait(childCtx, h, ch)

	return ch, nil
}

func (d *Driver) StopTask(taskID string, timeout time.Duration, signal string) error {
	ctx, span := d.tracer.Start(d.ctx, "stop-env-instance-task-validation", trace.WithAttributes(
		attribute.String("task_id", taskID),
	))
	defer span.End()

	h, ok := d.tasks.Get(taskID)
	if !ok {
		telemetry.ReportCriticalError(ctx, drivers.ErrTaskNotFound)
		return drivers.ErrTaskNotFound
	}

	childCtx, childSpan := d.tracer.Start(d.ctx, "stop-env-instance-task",
		trace.WithAttributes(
			attribute.String("task_id", taskID),
		),
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
			trace.LinkFromContext(h.ctx, attribute.String("link", "start-instance-task")),
		),
	)
	defer childSpan.End()

	if err := h.shutdown(childCtx, d); err != nil {
		errMsg := fmt.Errorf("executor Shutdown failed: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "shutdown task")

	return nil
}

func (d *Driver) DestroyTask(taskID string, force bool) error {
	ctx, span := d.tracer.Start(d.ctx, "destroy-env-instance-task-validation", trace.WithAttributes(
		attribute.String("task_id", taskID),
	))
	defer span.End()

	h, ok := d.tasks.Get(taskID)
	if !ok {
		telemetry.ReportCriticalError(ctx, drivers.ErrTaskNotFound)
		return drivers.ErrTaskNotFound
	}

	childCtx, childSpan := d.tracer.Start(d.ctx, "destroy-env-instance-task",
		trace.WithAttributes(
			attribute.String("task_id", taskID),
		),
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
			trace.LinkFromContext(h.ctx, attribute.String("link", "start-env-instance-task")),
		),
	)
	defer childSpan.End()

	if force {
		if err := h.shutdown(childCtx, d); err != nil {
			errMsg := fmt.Errorf("executor Shutdown failed: %w", err)
			telemetry.ReportCriticalError(childCtx, errMsg)
		}
		telemetry.ReportEvent(childCtx, "shutdown task")
	}

	err := h.Slot.RemoveNetwork(childCtx, d.tracer, d.hosts)
	if err != nil {
		errMsg := fmt.Errorf("cannot remove network when destroying task %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	}

	err = h.EnvInstanceFilesystem.Cleanup(childCtx, d.tracer)
	if err != nil {
		errMsg := fmt.Errorf("cannot remove env when destroying task %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	}

	err = h.Slot.Release(childCtx, h.ConsulToken, d.tracer)
	if err != nil {
		errMsg := fmt.Errorf("cannot release ip slot when destroying task %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	}

	d.tasks.Delete(taskID)
	telemetry.ReportEvent(childCtx, "task deleted")

	return nil
}

func (d *Driver) InspectTask(taskID string) (*drivers.TaskStatus, error) {
	handle, ok := d.tasks.Get(taskID)

	if !ok {
		return nil, drivers.ErrTaskNotFound
	}

	return handle.TaskStatus(), nil
}

func (d *Driver) TaskEvents(ctx context.Context) (<-chan *drivers.TaskEvent, error) {
	return d.eventer.TaskEvents(ctx)
}

func (d *Driver) TaskStats(ctx context.Context, taskID string, interval time.Duration) (<-chan *drivers.TaskResourceUsage, error) {
	_, ok := d.tasks.Get(taskID)
	if !ok {
		return nil, drivers.ErrTaskNotFound
	}

	return nil, drivers.DriverStatsNotImplemented
}

func (d *Driver) RecoverTask(handle *drivers.TaskHandle) error {
	if handle == nil {
		errMsg := fmt.Errorf("error: handle cannot be nil")
		return errMsg
	}

	return fmt.Errorf("cannot recover task")
}

func (d *Driver) handleWait(ctx context.Context, handle *taskHandle, ch chan *drivers.ExitResult) {
	defer close(ch)

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-d.ctx.Done():
			return
		case <-ticker.C:
			s := handle.TaskStatus()
			if s.State == drivers.TaskStateExited {
				ch <- handle.exitResult
			}
		}
	}
}

func (d *Driver) TaskConfigSchema() (*hclspec.Spec, error) {
	return taskConfigSpec, nil
}
