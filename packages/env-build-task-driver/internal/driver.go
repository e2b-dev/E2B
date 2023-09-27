package internal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/e2b-dev/infra/packages/env-build-task-driver/internal/env"
	"github.com/e2b-dev/infra/packages/env-build-task-driver/internal/telemetry"

	"github.com/docker/docker/client"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	pstructs "github.com/hashicorp/nomad/plugins/shared/structs"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const (
	pluginName        = "env-build-task-driver"
	pluginVersion     = "v0.1.0"
	fingerprintPeriod = 30 * time.Second
	taskHandleVersion = 1
	envBuildTimeout   = 30 * time.Minute
)

var (
	pluginInfo = &base.PluginInfoResponse{
		Type:              base.PluginTypeDriver,
		PluginApiVersions: []string{drivers.ApiVersion010},
		PluginVersion:     pluginVersion,
		Name:              pluginName,
	}

	taskConfigSpec = hclspec.NewObject(map[string]*hclspec.Spec{
		"BuildID": hclspec.NewAttr("BuildID", "string", true),
		"EnvID":   hclspec.NewAttr("EnvID", "string", true),

		"SpanID":  hclspec.NewAttr("SpanID", "string", true),
		"TraceID": hclspec.NewAttr("TraceID", "string", true),

		"VCpuCount":  hclspec.NewAttr("VCpuCount", "number", true),
		"MemoryMB":   hclspec.NewAttr("MemoryMB", "number", true),
		"DiskSizeMB": hclspec.NewAttr("DiskSizeMB", "number", true),
	})

	configSpec = hclspec.NewObject(map[string]*hclspec.Spec{})

	capabilities = &drivers.Capabilities{
		SendSignals: false,
		Exec:        false,
	}
)

type Config struct{}

type TaskConfig struct {
	BuildID string `codec:"BuildID"`
	EnvID   string `codec:"EnvID"`

	SpanID  string `codec:"SpanID"`
	TraceID string `codec:"TraceID"`

	VCpuCount  int64 `codec:"VCpuCount"`
	MemoryMB   int64 `codec:"MemoryMB"`
	DiskSizeMB int64 `codec:"DiskSizeMB"`
}

type TaskState struct {
	TaskConfig *drivers.TaskConfig
	StartedAt  time.Time
}

type Driver struct {
	tracer trace.Tracer

	// eventer is used to handle multiplexing of TaskEvents calls such that an
	// event can be broadcast to all callers
	eventer *eventer.Eventer

	// config is the plugin configuration set by the SetConfig RPC
	config *Config

	// nomadConfig is the client config from Nomad
	nomadConfig *base.ClientDriverConfig

	// tasks is the in memory datastore mapping taskIDs to driver handles
	tasks *taskStore

	// ctx is the context for the driver. It is passed to other subsystems to
	// coordinate shutdown
	ctx context.Context

	// signalShutdown is called when the driver is shutting down and cancels
	// the ctx passed to any subsystems
	signalShutdown context.CancelFunc

	// logger will log to the Nomad agent
	logger hclog.Logger

	docker *client.Client
}

func NewPlugin(logger hclog.Logger) drivers.DriverPlugin {
	ctx, cancel := context.WithCancel(context.Background())
	logger = logger.Named(pluginName)

	tracer := otel.Tracer("driver")

	// TODO: Configure and push finished images to the Artifact Repository
	client, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		panic(err)
	}

	return &Driver{
		tracer:         tracer,
		docker:         client,
		eventer:        eventer.NewEventer(ctx, logger),
		config:         &Config{},
		tasks:          newTaskStore(),
		ctx:            ctx,
		signalShutdown: cancel,
		logger:         logger,
	}
}

func (d *Driver) PluginInfo() (*base.PluginInfoResponse, error) {
	return pluginInfo, nil
}

func (d *Driver) ConfigSchema() (*hclspec.Spec, error) {
	return configSpec, nil
}

func (d *Driver) SetConfig(cfg *base.Config) error {
	var config Config
	if len(cfg.PluginConfig) != 0 {
		if err := base.MsgPackDecode(cfg.PluginConfig, &config); err != nil {
			return err
		}
	}

	d.config = &config

	if cfg.AgentConfig != nil {
		d.nomadConfig = cfg.AgentConfig.Driver
	}

	return nil
}

func (d *Driver) TaskConfigSchema() (*hclspec.Spec, error) {
	return taskConfigSpec, nil
}

func (d *Driver) Capabilities() (*drivers.Capabilities, error) {
	return capabilities, nil
}

func (d *Driver) Fingerprint(ctx context.Context) (<-chan *drivers.Fingerprint, error) {
	ch := make(chan *drivers.Fingerprint)
	go d.handleFingerprint(ctx, ch)

	return ch, nil
}

func (d *Driver) handleFingerprint(ctx context.Context, ch chan<- *drivers.Fingerprint) {
	defer close(ch)

	ticker := time.NewTimer(0)

	for {
		select {
		case <-ctx.Done():
			return
		case <-d.ctx.Done():
			return
		case <-ticker.C:
			ticker.Reset(fingerprintPeriod)
			ch <- d.buildFingerprint()
		}
	}
}

func (d *Driver) buildFingerprint() *drivers.Fingerprint {
	var health drivers.HealthState
	var desc string
	attrs := map[string]*pstructs.Attribute{"driver.env-build-task": pstructs.NewStringAttribute("1")}
	health = drivers.HealthStateHealthy
	desc = "ready"
	d.logger.Info("buildFingerprint()", "driver.FingerPrint", hclog.Fmt("%+v", health))
	return &drivers.Fingerprint{
		Attributes:        attrs,
		Health:            health,
		HealthDescription: desc,
	}
}

func (d *Driver) StartTask(cfg *drivers.TaskConfig) (*drivers.TaskHandle, *drivers.DriverNetwork, error) {
	ctx, span := d.tracer.Start(d.ctx, "start-task-validation", trace.WithAttributes(
		attribute.String("alloc_id", cfg.AllocID),
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
	handle := drivers.NewTaskHandle(taskHandleVersion)
	handle.Config = cfg

	tid, traceIDErr := trace.TraceIDFromHex(taskConfig.TraceID)
	if traceIDErr != nil {
		telemetry.ReportError(
			ctx,
			traceIDErr,
			attribute.String("trace_id", taskConfig.TraceID),
			attribute.Int("trace_id.length", len(taskConfig.TraceID)),
		)
	}

	sid, spanIDErr := trace.SpanIDFromHex(taskConfig.SpanID)
	if spanIDErr != nil {
		telemetry.ReportError(
			ctx,
			spanIDErr,
			attribute.String("span_id", taskConfig.SpanID),
			attribute.Int("span_id.length", len(taskConfig.SpanID)),
		)
	}

	remoteCtx := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    tid,
		SpanID:     sid,
		TraceFlags: 0x0,
	})

	_, childSpan := d.tracer.Start(
		trace.ContextWithRemoteSpanContext(d.ctx, remoteCtx),
		"start-task",
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
		),
	)
	defer childSpan.End()

	contextsPath := cfg.Env["DOCKER_CONTEXTS_PATH"]
	registry := cfg.Env["DOCKER_REGISTRY"]
	envsDisk := cfg.Env["ENVS_DISK"]
	kernelImagePath := cfg.Env["KERNEL_IMAGE_PATH"]
	envdPath := cfg.Env["ENVD_PATH"]
	firecrackerBinaryPath := cfg.Env["FIRECRACKER_BINARY_PATH"]
	contextFileName := cfg.Env["CONTEXT_FILE_NAME"]

	env := env.Env{
		BuildID:               taskConfig.BuildID,
		EnvID:                 taskConfig.EnvID,
		EnvsDiskPath:          envsDisk,
		VCpuCount:             taskConfig.VCpuCount,
		MemoryMB:              taskConfig.MemoryMB,
		DockerContextsPath:    contextsPath,
		DockerRegistry:        registry,
		KernelImagePath:       kernelImagePath,
		DiskSizeMB:            taskConfig.DiskSizeMB,
		FirecrackerBinaryPath: firecrackerBinaryPath,
		EnvdPath:              envdPath,
		ContextFileName:       contextFileName,
	}

	h := &taskHandle{
		taskConfig: cfg,
		procState:  drivers.TaskStateRunning,
		startedAt:  time.Now().Round(time.Millisecond),
		logger:     d.logger,
		env:        &env,
		exited:     make(chan struct{}),
	}

	driverState := TaskState{
		TaskConfig: cfg,
		StartedAt:  h.startedAt,
	}

	if err := handle.SetDriverState(&driverState); err != nil {
		return nil, nil, fmt.Errorf("failed to set driver state: %w", err)
	}

	d.tasks.Set(cfg.ID, h)

	go func() {
		buildContext, childBuildSpan := d.tracer.Start(
			trace.ContextWithSpanContext(context.Background(), childSpan.SpanContext()),
			"background-build-env",
		)
		h.run(buildContext, d.tracer, d.docker)
		childBuildSpan.End()
	}()

	return handle, nil, nil
}

func (d *Driver) RecoverTask(handle *drivers.TaskHandle) error {
	if handle == nil {
		return errors.New("error: handle cannot be nil")
	}

	return fmt.Errorf("Recover task not implemented")
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

	var result *drivers.ExitResult

	<-handle.exited

	handle.stateLock.RLock()

	if handle.exitResult != nil {
		if handle.exitResult.Err != nil {
			result = &drivers.ExitResult{
				Err: fmt.Errorf("executor: error waiting on process: %w", handle.exitResult.Err),
			}
		}
	}

	if result == nil {
		result = &drivers.ExitResult{}
	}

	handle.stateLock.RUnlock()

	for {
		select {
		case <-ctx.Done():
			return
		case <-d.ctx.Done():
			return
		case ch <- result:
		}
	}
}

func (d *Driver) StopTask(taskID string, timeout time.Duration, signal string) error {
	_, ok := d.tasks.Get(taskID)
	if !ok {
		return drivers.ErrTaskNotFound
	}

	return nil
}

func (d *Driver) DestroyTask(taskID string, force bool) error {
	_, ok := d.tasks.Get(taskID)
	if !ok {
		return drivers.ErrTaskNotFound
	}

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

func (d *Driver) TaskStats(ctx context.Context, taskID string, interval time.Duration) (<-chan *drivers.TaskResourceUsage, error) {
	_, ok := d.tasks.Get(taskID)
	if !ok {
		return nil, drivers.ErrTaskNotFound
	}

	emptyChannel := make(<-chan *drivers.TaskResourceUsage)
	return emptyChannel, nil
}

func (d *Driver) TaskEvents(ctx context.Context) (<-chan *drivers.TaskEvent, error) {
	return d.eventer.TaskEvents(ctx)
}

func (d *Driver) SignalTask(taskID string, signal string) error {
	return errors.New("This driver does not support exec")
}

func (d *Driver) ExecTask(taskID string, cmd []string, timeout time.Duration) (*drivers.ExecTaskResult, error) {
	return nil, errors.New("This driver does not support exec")
}
