package internal

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"github.com/e2b-dev/infra/packages/shared/pkg/driver"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/client/structs"
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

		HugePages bool `codec:"HugePages"`

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

	"HugePages": hclspec.NewAttr("HugePages", "bool", false),

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
			HugePages:             taskConfig.HugePages,
			UFFDBinaryPath:        filepath.Join(cfg.Env["FC_VERSIONS_DIR"], taskConfig.FirecrackerVersion, cfg.Env["UFFD_BINARY_NAME"]),
			FirecrackerBinaryPath: filepath.Join(cfg.Env["FC_VERSIONS_DIR"], taskConfig.FirecrackerVersion, cfg.Env["FC_BINARY_NAME"]),
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
		Exited:     make(chan struct{}),
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

	handle, ok := tasks.Get(taskID)
	if !ok {
		telemetry.ReportCriticalError(validationCtx, drivers.ErrTaskNotFound)
		return nil, drivers.ErrTaskNotFound
	}

	childCtx, childSpan := tracer.Start(ctx, "wait-env-instance-task",
		trace.WithAttributes(
			attribute.String("task.id", taskID),
		),
		trace.WithLinks(
			trace.LinkFromContext(validationCtx, attribute.String("link", "validation")),
			trace.LinkFromContext(handle.Ctx, attribute.String("link", "start-env-instance-task")),
		),
	)
	defer childSpan.End()

	ch := make(chan *drivers.ExitResult)
	go driver.HandleWait(childCtx, driverCtx, handle, ch)

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

	if !force {
		return fmt.Errorf("force is required to destroy task")
	}

	shutdownErr := h.Extra.shutdown(childCtx, tracer)
	if shutdownErr != nil {
		errMsg := fmt.Errorf("executor Shutdown failed: %w", shutdownErr)
		telemetry.ReportError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "shutdown task")
	}

	h.Extra.Instance.CleanupAfterFCStop(childCtx, tracer, de.hosts)

	telemetry.ReportEvent(childCtx, "cleanup after FC stop")

	tasks.Delete(taskID)
	telemetry.ReportEvent(childCtx, "task deleted")

	return nil
}

func (de *DriverExtra) TaskStats(ctx context.Context, driverCtx context.Context, tracer trace.Tracer, tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]], taskID string, interval time.Duration) (<-chan *structs.TaskResourceUsage, error) {
	h, ok := tasks.Get(taskID)
	if !ok {
		telemetry.ReportCriticalError(ctx, drivers.ErrTaskNotFound)

		return nil, drivers.ErrTaskNotFound
	}

	statsChannel := make(chan *drivers.TaskResourceUsage)
	go h.Extra.Stats(ctx, statsChannel, interval)

	return statsChannel, nil
}
