package internal

import (
	"context"
	"fmt"
	"time"

	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	pstructs "github.com/hashicorp/nomad/plugins/shared/structs"
	"github.com/txn2/txeh"

	"github.com/e2b-dev/api/packages/env-instance-task-driver/internal/env"
	"github.com/e2b-dev/api/packages/env-instance-task-driver/internal/slot"
	"github.com/e2b-dev/api/packages/env-instance-task-driver/internal/telemetry"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// https://opentelemetry.io/docs/instrumentation/go/getting-started/

const (
	pluginName        = "env-instance-task-driver"
	fingerprintPeriod = 30 * time.Second
	taskHandleVersion = 1
)

var (
	// pluginInfo is the response returned for the PluginInfo RPC
	pluginInfo = &base.PluginInfoResponse{
		Type:              base.PluginTypeDriver,
		PluginApiVersions: []string{drivers.ApiVersion010},
		PluginVersion:     "0.1.1-dev",
		Name:              pluginName,
	}

	// taskConfigSpec is the hcl specification for the driver config section of
	// a task within a job. It is returned in the TaskConfigSchema RPC
	taskConfigSpec = hclspec.NewObject(map[string]*hclspec.Spec{
		"InstanceID":       hclspec.NewAttr("InstanceID", "string", true),
		"EnvID":            hclspec.NewAttr("EnvID", "string", true),
		"SpanID":           hclspec.NewAttr("SpanID", "string", true),
		"TraceID":          hclspec.NewAttr("TraceID", "string", true),
		"LogsProxyAddress": hclspec.NewAttr("LogsProxyAddress", "string", true),
		"ConsulToken":      hclspec.NewAttr("ConsulToken", "string", true),
	})

	// capabilities is returned by the Capabilities RPC and indicates what
	// optional features this driver supports
	capabilities = &drivers.Capabilities{
		SendSignals: false,
		Exec:        false,
		FSIsolation: drivers.FSIsolationImage,
	}
)

type Driver struct {
	// eventer is used to handle multiplexing of TaskEvents calls such that an
	// event can be broadcast to all callers
	eventer *eventer.Eventer

	tracer trace.Tracer

	// config is the driver configuration set by the SetConfig RPC
	config *Config

	// nomadConfig is the client config from nomad
	nomadConfig *base.ClientDriverConfig

	// tasks is the in memory datastore mapping taskIDs to rawExecDriverHandles
	tasks *taskStore

	// ctx is the context for the driver. It is passed to other subsystems to
	// coordinate shutdown
	ctx context.Context

	// signalShutdown is called when the driver is shutting down and cancels the
	// ctx passed to any subsystems
	signalShutdown context.CancelFunc

	// logger will log to the Nomad agent
	logger hclog.Logger

	hosts *txeh.Hosts
}

// Config is the driver configuration set by the SetConfig RPC call
type (
	Config struct{}
	Nic    struct {
		Ip          string // CIDR
		Gateway     string
		Interface   string
		Nameservers []string
	}
)

// TaskConfig is the driver configuration of a task within a job
type TaskConfig struct {
	TraceID          string `codec:"TraceID"`
	SpanID           string `codec:"SpanID"`
	InstanceID       string `codec:"InstanceID"`
	LogsProxyAddress string `codec:"LogsProxyAddress"`
	ConsulToken      string `codec:"ConsulToken"`
	EnvID            string `codec:"EnvID"`
}

// TaskState is the state which is encoded in the handle returned in
// StartTask. This information is needed to rebuild the task state and handler
// during recovery.
type TaskState struct {
	TaskConfig    *drivers.TaskConfig
	ContainerName string
	StartedAt     time.Time
}

func NewFirecrackerDriver(logger hclog.Logger) drivers.DriverPlugin {
	ctx, cancel := context.WithCancel(context.Background())
	logger = logger.Named(pluginName)
	tracer := otel.Tracer("driver")

	hosts, err := txeh.NewHostsDefault()
	if err != nil {
		panic("Failed to initialize etc hosts handler")
	}

	err = hosts.Reload()
	if err != nil {
		panic("Failed to load etc hosts")
	}

	return &Driver{
		tracer:         tracer,
		eventer:        eventer.NewEventer(ctx, logger),
		config:         &Config{},
		tasks:          newTaskStore(),
		ctx:            ctx,
		signalShutdown: cancel,
		logger:         logger,
		hosts:          hosts,
	}
}

func (d *Driver) PluginInfo() (*base.PluginInfoResponse, error) {
	return pluginInfo, nil
}

func (d *Driver) ConfigSchema() (*hclspec.Spec, error) {
	return nil, nil
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

func (d *Driver) Shutdown(ctx context.Context) error {
	d.signalShutdown()
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
	attrs := map[string]*pstructs.Attribute{"driver.env-instance-task": pstructs.NewStringAttribute("1")}
	health = drivers.HealthStateHealthy
	desc = "ready"
	d.logger.Info("buildFingerprint()", "driver.FingerPrint", hclog.Fmt("%+v", health))
	return &drivers.Fingerprint{
		Attributes:        attrs,
		Health:            health,
		HealthDescription: desc,
	}
}

func (d *Driver) RecoverTask(handle *drivers.TaskHandle) error {
	ctx, span := d.tracer.Start(d.ctx, "recover-env-instance-task")
	defer span.End()

	if handle == nil {
		errMsg := fmt.Errorf("error: handle cannot be nil")
		telemetry.ReportCriticalError(ctx, errMsg)
		return errMsg
	}

	return fmt.Errorf("cannot recover task")
}

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

	childCtx, childSpan := d.tracer.Start(
		trace.ContextWithRemoteSpanContext(d.ctx, remoteCtx),
		"start-env-instance-task",
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
		),
	)
	defer childSpan.End()

	childSpan.SetAttributes(
		attribute.String("alloc_id", cfg.AllocID),
		attribute.String("env_id", taskConfig.EnvID),
		attribute.String("instance_id", taskConfig.InstanceID),
		attribute.String("client_id", cfg.Env["NOMAD_NODE_ID"]),
	)

	d.logger.Info("starting firecracker task", "task_cfg", hclog.Fmt("%+v", taskConfig))
	handle := drivers.NewTaskHandle(taskHandleVersion)
	handle.Config = cfg

	// Get slot from Consul KV
	ipSlot, err := slot.New(
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
			ntErr := RemoveNetwork(childCtx, ipSlot, d.hosts, taskConfig.ConsulToken, d.tracer)
			if ntErr != nil {
				errMsg := fmt.Errorf("error removing network namespace after failed instance start %w", ntErr)
				telemetry.ReportError(childCtx, errMsg)
			}
		}
	}()

	err = CreateNetwork(childCtx, ipSlot, d.hosts, d.tracer)
	if err != nil {
		errMsg := fmt.Errorf("failed to create namespaces %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "created network")

	fsEnv, err := env.New(
		childCtx,
		ipSlot,
		taskConfig.EnvID,
		cfg.Env["ENVS_DISK"],
		d.tracer,
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to create env for FC %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "created env for FC")

	defer func() {
		if err != nil {
			envErr := fsEnv.Delete(childCtx, d.tracer)
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
		ContainerName: fmt.Sprintf("%s-%s", cfg.Name, cfg.AllocID),
		TaskConfig:    cfg,
		StartedAt:     h.startedAt,
	}

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

func (d *Driver) handleWait(ctx context.Context, handle *taskHandle, ch chan *drivers.ExitResult) {
	defer close(ch)

	// // Going with simplest approach of polling for handler to mark exit.
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

	err := RemoveNetwork(childCtx, h.Slot, d.hosts, h.ConsulToken, d.tracer)
	if err != nil {
		errMsg := fmt.Errorf("cannot remove network when destroying task %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	}

	err = h.EnvInstanceFilesystem.Delete(childCtx, d.tracer)
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

// TaskStats will query the driver and return the current usage for the vm
func (d *Driver) TaskStats(ctx context.Context, taskID string, interval time.Duration) (<-chan *drivers.TaskResourceUsage, error) {
	handle, ok := d.tasks.Get(taskID)
	if !ok {
		return nil, drivers.ErrTaskNotFound
	}

	statsChannel := make(chan *drivers.TaskResourceUsage)
	go handle.stats(ctx, statsChannel, interval)

	return statsChannel, nil
}

func (d *Driver) TaskEvents(ctx context.Context) (<-chan *drivers.TaskEvent, error) {
	return d.eventer.TaskEvents(ctx)
}

func (d *Driver) ExecTask(taskID string, cmd []string, timeout time.Duration) (*drivers.ExecTaskResult, error) {
	return nil, fmt.Errorf("env-instance-task-driver does not support exec")
}

func (d *Driver) SignalTask(taskID string, signal string) error {
	return fmt.Errorf("env-instance-task-driver does not support signal")
}
