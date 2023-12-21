package internal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/e2b-dev/infra/packages/env-build-task-driver/internal/env"
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

		StartCmd string `codec:"StartCmd"`

		SpanID  string `codec:"SpanID"`
		TraceID string `codec:"TraceID"`

		VCpuCount  int64 `codec:"VCpuCount"`
		MemoryMB   int64 `codec:"MemoryMB"`
		DiskSizeMB int64 `codec:"DiskSizeMB"`
	}
)

func (d *Driver) StartTask(cfg *drivers.TaskConfig) (*drivers.TaskHandle, *drivers.DriverNetwork, error) {
	ctx, span := d.tracer.Start(d.ctx, "start-task-validation", trace.WithAttributes(
		attribute.String("alloc.id", cfg.AllocID),
	))
	defer span.End()

	if _, ok := d.tasks.Get(cfg.ID); ok {
		return nil, nil, fmt.Errorf("task with ID %q already started", cfg.ID)
	}

	var taskConfig TaskConfig
	if err := cfg.DecodeDriverConfig(&taskConfig); err != nil {
		return nil, nil, fmt.Errorf("failed to decode driver config: %w", err)
	}

	d.logger.Info("starting task", "task_cfg", hclog.Fmt("%+v", taskConfig))

	_, childSpan := telemetry.GetContextFromRemote(ctx, d.tracer, "start-task", taskConfig.SpanID, taskConfig.TraceID)
	defer childSpan.End()

	contextsPath := cfg.Env["DOCKER_CONTEXTS_PATH"]
	registry := cfg.Env["DOCKER_REGISTRY"]
	envsDisk := cfg.Env["ENVS_DISK"]
	kernelImagePath := cfg.Env["KERNEL_IMAGE_PATH"]
	envdPath := cfg.Env["ENVD_PATH"]
	firecrackerBinaryPath := cfg.Env["FIRECRACKER_BINARY_PATH"]
	contextFileName := cfg.Env["CONTEXT_FILE_NAME"]
	apiSecret := cfg.Env["API_SECRET"]
	googleServiceAccountBase64 := cfg.Env["GOOGLE_SERVICE_ACCOUNT_BASE64"]
	nomadToken := cfg.Env["NOMAD_TOKEN"]

	writer := env.NewWriter(taskConfig.EnvID, taskConfig.BuildID, apiSecret)

	env := env.Env{
		BuildID:                    taskConfig.BuildID,
		EnvID:                      taskConfig.EnvID,
		EnvsDiskPath:               envsDisk,
		VCpuCount:                  taskConfig.VCpuCount,
		MemoryMB:                   taskConfig.MemoryMB,
		DockerContextsPath:         contextsPath,
		DockerRegistry:             registry,
		KernelImagePath:            kernelImagePath,
		StartCmd:                   taskConfig.StartCmd,
		DiskSizeMB:                 taskConfig.DiskSizeMB,
		FirecrackerBinaryPath:      firecrackerBinaryPath,
		EnvdPath:                   envdPath,
		ContextFileName:            contextFileName,
		BuildLogsWriter:            writer,
		GoogleServiceAccountBase64: googleServiceAccountBase64,
		NomadToken:                 nomadToken,
	}

	cancellableBuildContext, cancel := context.WithCancel(d.ctx)

	h := &taskHandle{
		taskConfig: cfg,
		procState:  drivers.TaskStateRunning,
		startedAt:  time.Now().Round(time.Millisecond),
		logger:     d.logger,
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
		return nil, nil, fmt.Errorf("failed to set driver state: %w", err)
	}

	d.tasks.Set(cfg.ID, h)

	go func() {
		defer cancel()
		h.cancel = cancel

		buildContext, childBuildSpan := d.tracer.Start(
			trace.ContextWithSpanContext(cancellableBuildContext, childSpan.SpanContext()),
			"background-build-env",
		)
		defer childBuildSpan.End()

		h.run(buildContext, d.tracer, d.docker, d.legacyDockerClient)

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

func (d *Driver) RecoverTask(handle *drivers.TaskHandle) error {
	if handle == nil {
		return errors.New("error: handle cannot be nil")
	}

	return fmt.Errorf("recover task not implemented")
}

func (d *Driver) WaitTask(ctx context.Context, taskID string) (<-chan *drivers.ExitResult, error) {
	handle, ok := d.tasks.Get(taskID)
	if !ok {
		return nil, drivers.ErrTaskNotFound
	}

	ch := make(chan *drivers.ExitResult)
	go d.handleWait(ctx, handle, ch)

	return ch, nil
}

func (d *Driver) handleWait(ctx context.Context, handle *taskHandle, ch chan *drivers.ExitResult) {
	defer close(ch)

	for {
		select {
		case <-ctx.Done():
			return
		case <-d.ctx.Done():
			return
		case <-handle.ctx.Done():
			s := handle.TaskStatus()
			if s.State == drivers.TaskStateExited {
				ch <- handle.exitResult
			}
		}
	}
}

func (d *Driver) StopTask(taskID string, timeout time.Duration, signal string) error {
	handle, ok := d.tasks.Get(taskID)
	if !ok {
		return drivers.ErrTaskNotFound
	}

	handle.cancel()

	return nil
}

func (d *Driver) DestroyTask(taskID string, force bool) error {
	handle, ok := d.tasks.Get(taskID)
	if !ok {
		return drivers.ErrTaskNotFound
	}

	if handle.IsRunning() && !force {
		return errors.New("task is still running")
	}

	handle.cancel()
	d.tasks.Delete(taskID)

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

func (d *Driver) TaskConfigSchema() (*hclspec.Spec, error) {
	return taskConfigSpec, nil
}
