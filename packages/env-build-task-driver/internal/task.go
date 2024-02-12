package internal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/e2b-dev/infra/packages/env-build-task-driver/internal/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/driver"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const taskHandleVersion = 1

var taskConfigSpec = hclspec.NewObject(map[string]*hclspec.Spec{
	"BuildID": hclspec.NewAttr("BuildID", "string", true),
	"EnvID":   hclspec.NewAttr("EnvID", "string", true),

	"KernelVersion": hclspec.NewAttr("KernelVersion", "string", true),

	"StartCmd": hclspec.NewAttr("StartCmd", "string", false),

	"SpanID":  hclspec.NewAttr("SpanID", "string", true),
	"TraceID": hclspec.NewAttr("TraceID", "string", true),

	"VCpuCount":  hclspec.NewAttr("VCpuCount", "number", true),
	"MemoryMB":   hclspec.NewAttr("MemoryMB", "number", true),
	"DiskSizeMB": hclspec.NewAttr("DiskSizeMB", "number", true),
})

type (
	TaskState struct {
		TaskConfig *drivers.TaskConfig
		StartedAt  time.Time
	}

	TaskConfig struct {
		BuildID string `codec:"BuildID"`
		EnvID   string `codec:"EnvID"`

		KernelVersion string `codec:"KernelVersion"`

		StartCmd string `codec:"StartCmd"`

		SpanID  string `codec:"SpanID"`
		TraceID string `codec:"TraceID"`

		VCpuCount  int64 `codec:"VCpuCount"`
		MemoryMB   int64 `codec:"MemoryMB"`
		DiskSizeMB int64 `codec:"DiskSizeMB"`
	}
)

func (de *DriverExtra) StartTask(cfg *drivers.TaskConfig,
	driverCtx context.Context, tracer trace.Tracer, tasks *driver.TaskStore[*taskHandle], logger hclog.Logger,
) (*drivers.TaskHandle, *drivers.DriverNetwork, error) {
	ctx, span := tracer.Start(driverCtx, "start-task-validation", trace.WithAttributes(
		attribute.String("alloc.id", cfg.AllocID),
	))
	defer span.End()

	if _, ok := tasks.Get(cfg.ID); ok {
		return nil, nil, fmt.Errorf("task with ID %q already started", cfg.ID)
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

	contextsPath := cfg.Env["DOCKER_CONTEXTS_PATH"]
	registry := cfg.Env["DOCKER_REGISTRY"]
	envsDisk := cfg.Env["ENVS_DISK"]
	envdPath := cfg.Env["ENVD_PATH"]
	firecrackerBinaryPath := cfg.Env["FIRECRACKER_BINARY_PATH"]
	contextFileName := cfg.Env["CONTEXT_FILE_NAME"]
	apiSecret := cfg.Env["API_SECRET"]
	googleServiceAccountBase64 := cfg.Env["GOOGLE_SERVICE_ACCOUNT_BASE64"]
	nomadToken := cfg.Env["NOMAD_TOKEN"]
	kernelsDir := cfg.Env["KERNELS_DIR"]
	kernelMountDir := cfg.Env["KERNEL_MOUNT_DIR"]
	kernelName := cfg.Env["KERNEL_NAME"]

	telemetry.SetAttributes(childCtx,
		attribute.String("build_id", taskConfig.BuildID),
		attribute.String("env_id", taskConfig.EnvID),
		attribute.String("start_cmd", taskConfig.StartCmd),
		attribute.Int64("vcpu_count", taskConfig.VCpuCount),
		attribute.Int64("memory_mb", taskConfig.MemoryMB),
		attribute.Int64("disk_size_mb", taskConfig.DiskSizeMB),
		attribute.String("contexts_path", contextsPath),
		attribute.String("registry", registry),
		attribute.String("envs_disk", envsDisk),
		attribute.String("envd_path", envdPath),
		attribute.String("firecracker_binary_path", firecrackerBinaryPath),
		attribute.String("context_file_name", contextFileName),
		attribute.String("kernel_version", taskConfig.KernelVersion),
	)

	writer := env.NewWriter(taskConfig.EnvID, taskConfig.BuildID, apiSecret)

	env := env.Env{
		BuildID:                    taskConfig.BuildID,
		EnvID:                      taskConfig.EnvID,
		EnvsDiskPath:               envsDisk,
		VCpuCount:                  taskConfig.VCpuCount,
		MemoryMB:                   taskConfig.MemoryMB,
		DockerContextsPath:         contextsPath,
		DockerRegistry:             registry,
		KernelVersion:              taskConfig.KernelVersion,
		KernelsDir:                 kernelsDir,
		KernelMountDir:             kernelMountDir,
		KernelName:                 kernelName,
		StartCmd:                   taskConfig.StartCmd,
		DiskSizeMB:                 taskConfig.DiskSizeMB,
		FirecrackerBinaryPath:      firecrackerBinaryPath,
		EnvdPath:                   envdPath,
		ContextFileName:            contextFileName,
		BuildLogsWriter:            writer,
		GoogleServiceAccountBase64: googleServiceAccountBase64,
	}

	cancellableBuildContext, cancel := context.WithCancel(driverCtx)

	h := &taskHandle{
		taskConfig: cfg,
		taskState:  drivers.TaskStateRunning,
		startedAt:  time.Now().Round(time.Millisecond),
		logger:     logger,
		env:        &env,
		exited:     make(chan struct{}),
		cancel:     cancel,
		ctx:        cancellableBuildContext,
	}

	driverState := TaskState{
		TaskConfig: cfg,
		StartedAt:  h.startedAt,
	}

	handle := drivers.NewTaskHandle(taskHandleVersion)
	handle.Config = cfg

	if err := handle.SetDriverState(&driverState); err != nil {
		logger.Error("failed to start task, error setting driver state", "error", err)
		errMsg := fmt.Errorf("failed to set driver state: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, nil, errMsg
	}

	tasks.Set(cfg.ID, h)

	go func() {
		defer cancel()
		h.cancel = cancel

		buildContext, childBuildSpan := tracer.Start(
			trace.ContextWithSpanContext(cancellableBuildContext, childSpan.SpanContext()),
			"background-build-env",
		)
		defer childBuildSpan.End()

		h.run(buildContext, tracer, de.docker, de.legacyDockerClient, nomadToken)

		err := writer.Close()
		if err != nil {
			errMsg := fmt.Errorf("error closing build logs writer: %w", err)
			telemetry.ReportError(buildContext, errMsg)
		} else {
			telemetry.ReportEvent(buildContext, "build logs writer closed")
		}

		<-writer.Done
	}()

	return handle, nil, nil
}

func (de *DriverExtra) WaitTask(ctx, driverCtx context.Context, tracer trace.Tracer, tasks *driver.TaskStore[*taskHandle], logger hclog.Logger, taskID string) (<-chan *drivers.ExitResult, error) {
	handle, ok := tasks.Get(taskID)
	if !ok {
		return nil, drivers.ErrTaskNotFound
	}

	ch := make(chan *drivers.ExitResult)
	go handleWait(ctx, driverCtx, handle, ch)

	return ch, nil
}

func handleWait(ctx, driverCtx context.Context, handle *taskHandle, ch chan *drivers.ExitResult) {
	defer close(ch)

	for {
		select {
		case <-ctx.Done():
			return
		case <-driverCtx.Done():
			return
		case <-handle.ctx.Done():
			s := handle.TaskStatus()
			if s.State == drivers.TaskStateExited {
				ch <- handle.exitResult
			}
		}
	}
}

func (de *DriverExtra) StopTask(ctx context.Context, tracer trace.Tracer, tasks *driver.TaskStore[*taskHandle], logger hclog.Logger, taskID string, timeout time.Duration, signal string) error {
	handle, ok := tasks.Get(taskID)
	if !ok {
		return drivers.ErrTaskNotFound
	}

	handle.cancel()

	return nil
}

func (de *DriverExtra) DestroyTask(ctx context.Context, tracer trace.Tracer, tasks *driver.TaskStore[*taskHandle], logger hclog.Logger, taskID string, force bool) error {
	handle, ok := tasks.Get(taskID)
	if !ok {
		return drivers.ErrTaskNotFound
	}

	if handle.IsRunning() && !force {
		return errors.New("task is still running")
	}

	handle.cancel()
	tasks.Delete(taskID)

	return nil
}
