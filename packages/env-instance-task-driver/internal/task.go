package internal

import (
	"context"
	"fmt"
	"time"

	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/instance"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
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

	d.logger.Info("starting task", "task_cfg", hclog.Fmt("%+v", taskConfig))

	childCtx, childSpan := telemetry.GetContextFromRemote(d.ctx, d.tracer, "start-task", taskConfig.SpanID, taskConfig.TraceID)
	defer childSpan.End()

	telemetry.SetAttributes(
		childCtx,
		attribute.String("alloc_id", cfg.AllocID),
		attribute.String("env_id", taskConfig.EnvID),
		attribute.String("instance_id", taskConfig.InstanceID),
		attribute.String("client_id", cfg.Env["NOMAD_NODE_ID"]),
	)
	instance, err := instance.NewInstance(
		childCtx,
		d.tracer,
		&instance.InstanceConfig{
			EnvID:            taskConfig.EnvID,
			AllocID:          cfg.AllocID,
			InstanceID:       taskConfig.InstanceID,
			TraceID:          taskConfig.TraceID,
			ConsulToken:      taskConfig.ConsulToken,
			LogsProxyAddress: taskConfig.LogsProxyAddress,
			NodeID:           cfg.Env["NOMAD_NODE_ID"],
			EnvsDisk:         cfg.Env["ENVS_DISK"],
		},
		d.hosts,
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to create instance: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		d.logger.Info("Error starting instance", "driver_cfg", hclog.Fmt("%+v", errMsg))

		return nil, nil, errMsg
	}

	h := &taskHandle{
		ctx:        childCtx,
		taskConfig: cfg,
		taskState:  drivers.TaskStateRunning,
		startedAt:  time.Now().Round(time.Millisecond),
		logger:     d.logger,
		Instance:   instance,
	}

	driverState := TaskState{
		TaskConfig: cfg,
		StartedAt:  h.startedAt,
	}

	handle := drivers.NewTaskHandle(taskHandleVersion)
	handle.Config = cfg

	if err := handle.SetDriverState(&driverState); err != nil {
		stopErr := instance.FC.Stop(childCtx, d.tracer)
		if stopErr != nil {
			errMsg := fmt.Errorf("error stopping machine after error: %w", stopErr)
			telemetry.ReportError(childCtx, errMsg)
		}

		instance.CleanupAfterFCStop(childCtx, d.tracer, d.hosts)

		errMsg := fmt.Errorf("failed to set driver state: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		d.logger.Error("failed to start task, error setting driver state", "error", err)

		return nil, nil, errMsg
	}

	d.tasks.Set(cfg.ID, h)

	go func() {
		instanceContext, instanceSpan := d.tracer.Start(
			trace.ContextWithSpanContext(d.ctx, childSpan.SpanContext()),
			"background-running-instance",
		)
		defer instanceSpan.End()

		h.run(instanceContext, d)
	}()

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

	h.Instance.CleanupAfterFCStop(childCtx, d.tracer, d.hosts)

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

	// TODO: Use context for waiting for task
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
