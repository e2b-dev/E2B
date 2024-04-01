package internal

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"time"

	"github.com/e2b-dev/infra/packages/env-build-task-driver/internal/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/driver"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/client/structs"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const taskHandleVersion = 1

var taskConfigSpec = hclspec.NewObject(map[string]*hclspec.Spec{
	"BuildID": hclspec.NewAttr("BuildID", "string", true),
	"EnvID":   hclspec.NewAttr("EnvID", "string", true),

	"KernelVersion":      hclspec.NewAttr("KernelVersion", "string", true),
	"FirecrackerVersion": hclspec.NewAttr("FirecrackerVersion", "string", true),

	"HugePages": hclspec.NewAttr("HugePages", "bool", false),

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

		KernelVersion      string `codec:"KernelVersion"`
		FirecrackerVersion string `codec:"FirecrackerVersion"`

		HugePages bool `codec:"HugePages"`

		StartCmd string `codec:"StartCmd"`

		SpanID  string `codec:"SpanID"`
		TraceID string `codec:"TraceID"`

		VCpuCount  int64 `codec:"VCpuCount"`
		MemoryMB   int64 `codec:"MemoryMB"`
		DiskSizeMB int64 `codec:"DiskSizeMB"`
	}
)

func (de *DriverExtra) StartTask(
	driverCtx context.Context,
	tracer trace.Tracer,
	logger hclog.Logger,
	cfg *drivers.TaskConfig,
	tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]],
) (*drivers.TaskHandle, *drivers.DriverNetwork, error) {
	bgContext, bgCancel := context.WithCancel(driverCtx)
	defer bgCancel()

	ctx, span := tracer.Start(bgContext, "start-task-validation", trace.WithAttributes(
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
	contextFileName := cfg.Env["CONTEXT_FILE_NAME"]
	apiSecret := cfg.Env["API_SECRET"]
	googleServiceAccountBase64 := cfg.Env["GOOGLE_SERVICE_ACCOUNT_BASE64"]
	nomadToken := cfg.Env["NOMAD_TOKEN"]
	kernelsDir := cfg.Env["KERNELS_DIR"]
	kernelMountDir := cfg.Env["KERNEL_MOUNT_DIR"]
	kernelName := cfg.Env["KERNEL_NAME"]
	firecrackerVersionsDir := cfg.Env["FC_VERSIONS_DIR"]
	firecrackerBinaryName := cfg.Env["FC_BINARY_NAME"]

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
		attribute.String("context_file_name", contextFileName),
		attribute.String("kernel_version", taskConfig.KernelVersion),
		attribute.String("firecracker_version", taskConfig.FirecrackerVersion),
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
		FirecrackerBinaryPath:      filepath.Join(firecrackerVersionsDir, taskConfig.FirecrackerVersion, firecrackerBinaryName),
		EnvdPath:                   envdPath,
		ContextFileName:            contextFileName,
		BuildLogsWriter:            writer,
		GoogleServiceAccountBase64: googleServiceAccountBase64,
		HugePages:                  taskConfig.HugePages,
	}

	cancellableBuildContext, cancel := context.WithCancel(driverCtx)

	h := &driver.TaskHandle[*extraTaskHandle]{
		TaskConfig: cfg,
		TaskState:  drivers.TaskStateRunning,
		StartedAt:  time.Now().Round(time.Millisecond),
		Logger:     logger,
		Exited:     make(chan struct{}),
		Cancel:     cancel,
		Ctx:        cancellableBuildContext,
		Extra: &extraTaskHandle{
			env:          &env,
			docker:       de.docker,
			legacyDocker: de.legacyDockerClient,
			nomadToken:   nomadToken,
		},
	}

	driverState := TaskState{
		TaskConfig: cfg,
		StartedAt:  h.StartedAt,
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

		buildContext, childBuildSpan := tracer.Start(
			trace.ContextWithSpanContext(cancellableBuildContext, childSpan.SpanContext()),
			"background-build-env",
		)
		defer childBuildSpan.End()

		h.Run(buildContext, tracer)

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

func (de *DriverExtra) WaitTask(
	ctx,
	driverCtx context.Context,
	_ trace.Tracer,
	_ hclog.Logger,
	tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]],
	taskID string,
) (<-chan *drivers.ExitResult, error) {
	handle, ok := tasks.Get(taskID)
	if !ok {
		return nil, drivers.ErrTaskNotFound
	}

	ch := make(chan *drivers.ExitResult)
	go driver.HandleWait(ctx, driverCtx, handle, ch)

	return ch, nil
}

func (de *DriverExtra) StopTask(
	_ context.Context,
	_ trace.Tracer,
	_ hclog.Logger,
	tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]],
	taskID string,
	timeout time.Duration,
	signal string,
) error {
	handle, ok := tasks.Get(taskID)
	if !ok {
		return drivers.ErrTaskNotFound
	}

	handle.Cancel()

	return nil
}

func (de *DriverExtra) DestroyTask(
	_ context.Context,
	_ trace.Tracer,
	_ hclog.Logger,
	tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]],
	taskID string,
	force bool,
) error {
	handle, ok := tasks.Get(taskID)
	if !ok {
		return drivers.ErrTaskNotFound
	}

	if handle.IsRunning() && !force {
		return errors.New("task is still running")
	}

	handle.Cancel()
	tasks.Delete(taskID)

	return nil
}

func (de *DriverExtra) TaskStats(
	ctx,
	driverCtx context.Context,
	tracer trace.Tracer,
	_ hclog.Logger,
	tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]],
	taskID string,
	interval time.Duration,
) (<-chan *structs.TaskResourceUsage, error) {
	_, ok := tasks.Get(taskID)
	if !ok {
		telemetry.ReportCriticalError(ctx, drivers.ErrTaskNotFound)

		return nil, drivers.ErrTaskNotFound
	}

	statsChannel := make(chan *drivers.TaskResourceUsage)
	go driver.Stats(ctx, driverCtx, statsChannel, interval)

	return statsChannel, nil
}
