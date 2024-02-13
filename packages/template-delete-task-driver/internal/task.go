package internal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/driver"
	"github.com/e2b-dev/infra/packages/shared/pkg/storages"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/e2b-dev/infra/packages/template-delete-task-driver/internal/template"
)

const taskHandleVersion = 1

var taskConfigSpec = hclspec.NewObject(map[string]*hclspec.Spec{
	"TemplateID": hclspec.NewAttr("TemplateID", "string", true),

	"SpanID":  hclspec.NewAttr("SpanID", "string", true),
	"TraceID": hclspec.NewAttr("TraceID", "string", true),
})

type (
	TaskState struct {
		TaskConfig *drivers.TaskConfig
		StartedAt  time.Time
	}

	TaskConfig struct {
		TemplateID string `codec:"TemplateID"`

		SpanID  string `codec:"SpanID"`
		TraceID string `codec:"TraceID"`
	}
)

func (de *DriverExtra) StartTask(cfg *drivers.TaskConfig,
	driverCtx context.Context, tracer trace.Tracer, tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]], logger hclog.Logger,
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
	projectID := cfg.Env["PROJECT_ID"]
	region := cfg.Env["REGION"]
	bucketName := cfg.Env["BUCKET_NAME"]

	telemetry.SetAttributes(childCtx,
		attribute.String("template_id", taskConfig.TemplateID),
		attribute.String("contexts_path", contextsPath),
		attribute.String("contexts_bucket", bucketName),
		attribute.String("registry", registry),
		attribute.String("envs_disk", envsDisk),
	)

	tmp := template.Template{
		TemplateID:         taskConfig.TemplateID,
		EnvsDiskPath:       envsDisk,
		DockerContextsPath: contextsPath,
		DockerRegistryName: registry,

		ProjectID: projectID,
		Region:    region,

		BucketName: bucketName,
	}

	cloudStorage, err := storages.NewGoogleCloudStorage(ctx, bucketName)
	if err != nil {
		errMsg := fmt.Errorf("failed to initialize Google Cloud Storage client: %w", err)

		telemetry.ReportCriticalError(ctx, errMsg)
		return nil, nil, errMsg
	}

	logger.Info("Initialized Google Cloud Storage client")

	cancellableContext, cancel := context.WithCancel(driverCtx)

	h := &driver.TaskHandle[*extraTaskHandle]{
		TaskConfig: cfg,
		TaskState:  drivers.TaskStateRunning,
		StartedAt:  time.Now().Round(time.Millisecond),
		Logger:     logger,
		Exited:     make(chan struct{}),
		Cancel:     cancel,
		Ctx:        cancellableContext,
		Extra: &extraTaskHandle{
			template:         &tmp,
			storage:          cloudStorage,
			artifactRegistry: de.artifactRegistry,
		},
	}

	driverState := TaskState{
		TaskConfig: cfg,
		StartedAt:  h.StartedAt,
	}

	handle := drivers.NewTaskHandle(taskHandleVersion)
	handle.Config = cfg

	if err = handle.SetDriverState(&driverState); err != nil {
		logger.Error("failed to start task, error setting driver state", "error", err)
		errMsg := fmt.Errorf("failed to set driver state: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, nil, errMsg
	}

	tasks.Set(cfg.ID, h)

	go func() {
		defer cancel()
		h.Cancel = cancel

		deleteContext, childDeleteSpan := tracer.Start(
			trace.ContextWithSpanContext(cancellableContext, childSpan.SpanContext()),
			"background-delete-template",
		)
		defer childDeleteSpan.End()

		h.Run(deleteContext, tracer)
	}()

	return handle, nil, nil
}

func (de *DriverExtra) WaitTask(ctx, driverCtx context.Context, _ trace.Tracer, tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]], _ hclog.Logger, taskID string) (<-chan *drivers.ExitResult, error) {
	handle, ok := tasks.Get(taskID)
	if !ok {
		return nil, drivers.ErrTaskNotFound
	}

	ch := make(chan *drivers.ExitResult)
	go handleWait(ctx, driverCtx, handle, ch)

	return ch, nil
}

func handleWait(ctx, driverCtx context.Context, handle *driver.TaskHandle[*extraTaskHandle], ch chan *drivers.ExitResult) {
	defer close(ch)

	for {
		select {
		case <-ctx.Done():
			return
		case <-driverCtx.Done():
			return
		case <-handle.Ctx.Done():
			s := handle.TaskStatus()
			if s.State == drivers.TaskStateExited {
				ch <- handle.ExitResult
			}
		}
	}
}

func (de *DriverExtra) StopTask(_ context.Context, _ trace.Tracer, tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]], _ hclog.Logger, taskID string, timeout time.Duration, signal string) error {
	handle, ok := tasks.Get(taskID)
	if !ok {
		return drivers.ErrTaskNotFound
	}

	handle.Cancel()

	return nil
}

func (de *DriverExtra) DestroyTask(_ context.Context, _ trace.Tracer, tasks *driver.TaskStore[*driver.TaskHandle[*extraTaskHandle]], _ hclog.Logger, taskID string, force bool) error {
	handle, ok := tasks.Get(taskID)
	if !ok {
		return drivers.ErrTaskNotFound
	}

	if handle.IsRunning() && !force {
		return errors.New("task is still running")
	}

	err := handle.Extra.storage.Close()
	if err != nil {
		return fmt.Errorf("error closing Cloud Storage client: %v", err)
	}

	handle.Cancel()
	tasks.Delete(taskID)

	return nil
}
