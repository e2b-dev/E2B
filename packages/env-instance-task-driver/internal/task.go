package internal

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"github.com/e2b-dev/infra/packages/shared/pkg/driver"
	"github.com/hashicorp/go-hclog"
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

		KernelVersion      string `codec:"KernelVersion"`
		FirecrackerVersion string `codec:"FirecrackerVersion"`

		TeamID string `codec:"TeamID"`

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

	"KernelVersion":      hclspec.NewAttr("KernelVersion", "string", true),
	"FirecrackerVersion": hclspec.NewAttr("FirecrackerVersion", "string", true),

	"TeamID": hclspec.NewAttr("TeamID", "string", false),

	"SpanID":  hclspec.NewAttr("SpanID", "string", true),
	"TraceID": hclspec.NewAttr("TraceID", "string", true),

	"LogsProxyAddress": hclspec.NewAttr("LogsProxyAddress", "string", true),

	"ConsulToken": hclspec.NewAttr("ConsulToken", "string", true),
})

func (de *DriverExtra) StartTask(cfg *drivers.TaskConfig,
	ctx context.Context, tracer trace.Tracer, tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]], logger hclog.Logger,
) (*drivers.TaskHandle, *drivers.DriverNetwork, error) {
	ctx, span := tracer.Start(ctx, "start-env-instance-task-validation", trace.WithAttributes(
		attribute.String("alloc.id", cfg.AllocID),
	))
	defer span.End()

	if _, ok := tasks.Get(cfg.ID); ok {
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

	logger.Info("starting task", "task_cfg", hclog.Fmt("%+v", taskConfig))

	childCtx, childSpan := telemetry.GetContextFromRemote(ctx, tracer, "start-task", taskConfig.SpanID, taskConfig.TraceID)
	defer childSpan.End()

	childSpan.SetAttributes(
		attribute.String("alloc.id", cfg.AllocID),
		attribute.String("env.id", taskConfig.EnvID),
		attribute.String("env.kernel.version", taskConfig.KernelVersion),
		attribute.String("instance.id", taskConfig.InstanceID),
		attribute.String("client.id", cfg.Env["NOMAD_NODE_ID"]),
	)
	instance, err := instance.NewInstance(
		childCtx,
		tracer,
		&instance.InstanceConfig{
			EnvID:                 taskConfig.EnvID,
			AllocID:               cfg.AllocID,
			InstanceID:            taskConfig.InstanceID,
			TraceID:               taskConfig.TraceID,
			TeamID:                taskConfig.TeamID,
			ConsulToken:           taskConfig.ConsulToken,
			LogsProxyAddress:      taskConfig.LogsProxyAddress,
			KernelVersion:         taskConfig.KernelVersion,
			NodeID:                cfg.Env["NOMAD_NODE_ID"],
			EnvsDisk:              cfg.Env["ENVS_DISK"],
			KernelsDir:            cfg.Env["KERNELS_DIR"],
			KernelMountDir:        cfg.Env["KERNEL_MOUNT_DIR"],
			KernelName:            cfg.Env["KERNEL_NAME"],
			FirecrackerBinaryPath: filepath.Join(cfg.Env["FC_VERSIONS_DIR"], taskConfig.FirecrackerVersion),
		},
		de.hosts,
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to create instance: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		logger.Info("Error starting instance", "driver_cfg", hclog.Fmt("%+v", errMsg))

		return nil, nil, errMsg
	}

	h := &driver.TaskHandle[*extraTaskHandle]{
		Ctx:        childCtx,
		TaskConfig: cfg,
		TaskState:  drivers.TaskStateRunning,
		StartedAt:  time.Now().Round(time.Millisecond),
		Logger:     logger,
		Extra: &extraTaskHandle{
			Instance: instance,
		},
	}

	driverState := TaskState{
		TaskConfig: cfg,
		StartedAt:  h.StartedAt,
	}

	handle := drivers.NewTaskHandle(taskHandleVersion)
	handle.Config = cfg

	if err := handle.SetDriverState(&driverState); err != nil {
		stopErr := instance.FC.Stop(childCtx, tracer)
		if stopErr != nil {
			errMsg := fmt.Errorf("error stopping machine after error: %w", stopErr)
			telemetry.ReportError(childCtx, errMsg)
		}

		instance.CleanupAfterFCStop(childCtx, tracer, de.hosts)

		errMsg := fmt.Errorf("failed to set driver state: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		logger.Error("failed to start task, error setting driver state", "error", err)

		return nil, nil, errMsg
	}

	tasks.Set(cfg.ID, h)

	go h.Run(context.Background(), tracer)

	return handle, nil, nil
}

func (de *DriverExtra) WaitTask(ctx context.Context, driverCtx context.Context, tracer trace.Tracer, tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]], _ hclog.Logger, taskID string) (<-chan *drivers.ExitResult, error) {
	validationCtx, validationSpan := tracer.Start(ctx, "wait-env-instance-task-validation", trace.WithAttributes(
		attribute.String("task.id", taskID),
	))
	defer validationSpan.End()

	h, ok := tasks.Get(taskID)
	if !ok {
		telemetry.ReportCriticalError(validationCtx, drivers.ErrTaskNotFound)
		return nil, drivers.ErrTaskNotFound
	}

	childCtx, childSpan := tracer.Start(driverCtx, "wait-env-instance-task",
		trace.WithAttributes(
			attribute.String("task.id", taskID),
		),
		trace.WithLinks(
			trace.LinkFromContext(validationCtx, attribute.String("link", "validation")),
			trace.LinkFromContext(h.Ctx, attribute.String("link", "start-env-instance-task")),
		),
	)
	defer childSpan.End()

	ch := make(chan *drivers.ExitResult)
	go handleWait(childCtx, driverCtx, h, ch)

	return ch, nil
}

func (de *DriverExtra) StopTask(ctx context.Context, tracer trace.Tracer, tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]], _ hclog.Logger, taskID string, timeout time.Duration, signal string) error {
	ctx, span := tracer.Start(ctx, "stop-env-instance-task-validation", trace.WithAttributes(
		attribute.String("task.id", taskID),
	))
	defer span.End()

	h, ok := tasks.Get(taskID)
	if !ok {
		telemetry.ReportCriticalError(ctx, drivers.ErrTaskNotFound)
		return drivers.ErrTaskNotFound
	}

	childCtx, childSpan := tracer.Start(ctx, "stop-env-instance-task",
		trace.WithAttributes(
			attribute.String("task.id", taskID),
		),
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
			trace.LinkFromContext(h.Ctx, attribute.String("link", "start-instance-task")),
		),
	)
	defer childSpan.End()

	if err := h.Extra.shutdown(childCtx, tracer); err != nil {
		errMsg := fmt.Errorf("executor Shutdown failed: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "shutdown task")

	return nil
}

func (de *DriverExtra) DestroyTask(ctx context.Context, tracer trace.Tracer, tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]], _ hclog.Logger, taskID string, force bool) error {
	ctx, span := tracer.Start(ctx, "destroy-env-instance-task-validation", trace.WithAttributes(
		attribute.String("task.id", taskID),
	))
	defer span.End()

	h, ok := tasks.Get(taskID)
	if !ok {
		telemetry.ReportCriticalError(ctx, drivers.ErrTaskNotFound)
		return drivers.ErrTaskNotFound
	}

	childCtx, childSpan := tracer.Start(ctx, "destroy-env-instance-task",
		trace.WithAttributes(
			attribute.String("task.id", taskID),
		),
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
			trace.LinkFromContext(h.Ctx, attribute.String("link", "start-env-instance-task")),
		),
	)
	defer childSpan.End()

	if force {
		if err := h.Extra.shutdown(childCtx, tracer); err == nil {
			telemetry.ReportEvent(childCtx, "waiting for state lock")

			h.Mu.Lock()
			h.ExitResult = &drivers.ExitResult{}
			h.ExitResult.ExitCode = 0
			h.ExitResult.Signal = 0
			h.CompletedAt = time.Now()
			h.TaskState = drivers.TaskStateExited
			h.Mu.Unlock()

			telemetry.ReportEvent(childCtx, "updated task exit info")
		} else {
			errMsg := fmt.Errorf("executor Shutdown failed: %w", err)
			telemetry.ReportCriticalError(childCtx, errMsg)

			h.Mu.Lock()
			h.ExitResult = &drivers.ExitResult{}
			h.ExitResult.ExitCode = 1
			h.ExitResult.Signal = 0
			h.CompletedAt = time.Now()
			h.TaskState = drivers.TaskStateUnknown
			h.ExitResult.Err = errMsg
			h.Mu.Unlock()
		}

		telemetry.ReportEvent(childCtx, "shutdown task")
	}

	h.Extra.Instance.CleanupAfterFCStop(childCtx, tracer, de.hosts)

	tasks.Delete(taskID)
	telemetry.ReportEvent(childCtx, "task deleted")

	return nil
}

func handleWait(ctx context.Context, driverCtx context.Context, handle *driver.TaskHandle[*extraTaskHandle], ch chan *drivers.ExitResult) {
	defer close(ch)

	// TODO: Use context for waiting for task
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-driverCtx.Done():
			return
		case <-ticker.C:
			s := handle.TaskStatus()
			if s.State == drivers.TaskStateExited {
				ch <- handle.ExitResult
			}
		}
	}
}
