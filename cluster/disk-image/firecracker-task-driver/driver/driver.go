/* Firecracker-task-driver is a task driver for Hashicorp's nomad that allows
 * to create microvms using AWS Firecracker vmm
 * Copyright (C) 2019  Carlos Neira cneirabustos@gmail.com
 *
 * This file is part of Firecracker-task-driver.
 *
 * Foobar is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * Firecracker-task-driver is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Firecracker-task-driver. If not, see <http://www.gnu.org/licenses/>.
 */

package firevm

import (
	"context"
	"fmt"
	"os"
	"time"

	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/client/stats"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	pstructs "github.com/hashicorp/nomad/plugins/shared/structs"
	"github.com/txn2/txeh"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// https://opentelemetry.io/docs/instrumentation/go/getting-started/

const (
	// pluginName is the name of the plugin
	pluginName = "firecracker-task-driver"

	// fingerprintPeriod is the interval at which the driver will send fingerprint responses
	fingerprintPeriod = 30 * time.Second

	// taskHandleVersion is the version of task handle which this driver sets
	// and understands how to decode driver state
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
		"SessionID":     hclspec.NewAttr("SessionID", "string", false),
		"CodeSnippetID": hclspec.NewAttr("CodeSnippetID", "string", false),
		"EditEnabled":   hclspec.NewAttr("EditEnabled", "bool", false),
		"SpanID":        hclspec.NewAttr("SpanID", "string", false),
		"TraceID":       hclspec.NewAttr("TraceID", "string", false),
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

func (d *Driver) ReportEvent(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)

	fmt.Println(name, attrs)

	span.AddEvent(name,
		trace.WithAttributes(attrs...),
	)
}

func (d *Driver) ReportCriticalError(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)

	fmt.Fprint(os.Stderr, err.Error())

	span.RecordError(err,
		trace.WithStackTrace(true),
	)
	span.SetStatus(codes.Error, "critical error")
}

func (d *Driver) ReportError(ctx context.Context, err error, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)

	fmt.Fprint(os.Stderr, err.Error())

	span.RecordError(err,
		trace.WithStackTrace(true),
		trace.WithAttributes(
			attrs...,
		),
	)
}

// Config is the driver configuration set by the SetConfig RPC call
type Config struct {
}
type Nic struct {
	Ip          string // CIDR
	Gateway     string
	Interface   string
	Nameservers []string
}

// TaskConfig is the driver configuration of a task within a job
type TaskConfig struct {
	TraceID       string `codec:"TraceID"`
	SpanID        string `codec:"SpanID"`
	SessionID     string `codec:"SessionID"`
	EditEnabled   bool   `codec:"EditEnabled"`
	CodeSnippetID string `codec:"CodeSnippetID"`
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
	attrs := map[string]*pstructs.Attribute{"driver.firecracker-task": pstructs.NewStringAttribute("1")}
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
	ctx, span := d.tracer.Start(d.ctx, "recover-session-task")
	defer span.End()

	if handle == nil {
		errMsg := fmt.Errorf("error: handle cannot be nil")
		d.ReportCriticalError(ctx, errMsg)
		return errMsg
	}

	oldHandle, ok := d.tasks.Get(handle.Config.ID)

	if ok {
		return nil
	}

	if oldHandle != nil {
		oldHandle.shutdown(ctx, d)
	}

	return fmt.Errorf("cannot recover task")
}

func (d *Driver) StartTask(cfg *drivers.TaskConfig) (*drivers.TaskHandle, *drivers.DriverNetwork, error) {
	ctx, span := d.tracer.Start(d.ctx, "start-session-task-validation", trace.WithAttributes(
		attribute.String("alloc_id", cfg.AllocID),
	))
	defer span.End()

	if _, ok := d.tasks.Get(cfg.ID); ok {
		errMsg := fmt.Errorf("task with ID %q already started", cfg.ID)

		d.ReportCriticalError(ctx, errMsg)
		return nil, nil, errMsg
	}

	var driverConfig TaskConfig
	if err := cfg.DecodeDriverConfig(&driverConfig); err != nil {
		errMsg := fmt.Errorf("failed to decode driver config: %v", err)

		d.ReportCriticalError(ctx, errMsg)
		return nil, nil, errMsg
	}

	tid, traceIDErr := trace.TraceIDFromHex(driverConfig.TraceID)
	if traceIDErr != nil {
		d.ReportError(
			ctx,
			traceIDErr,
			attribute.String("trace_id", driverConfig.TraceID),
			attribute.Int("trace_id.length", len(driverConfig.TraceID)),
		)
	}

	sid, spanIDErr := trace.SpanIDFromHex(driverConfig.SpanID)
	if spanIDErr != nil {
		d.ReportError(
			ctx,
			spanIDErr,
			attribute.String("span_id", driverConfig.SpanID),
			attribute.Int("span_id.length", len(driverConfig.SpanID)),
		)
	}

	remoteCtx := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    tid,
		SpanID:     sid,
		TraceFlags: 0x0,
	})

	childCtx, childSpan := d.tracer.Start(
		trace.ContextWithRemoteSpanContext(d.ctx, remoteCtx),
		"start-session-task",
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
		),
	)
	defer childSpan.End()

	childSpan.SetAttributes(
		attribute.String("alloc_id", cfg.AllocID),
		attribute.String("code_snippet_id", driverConfig.CodeSnippetID),
		attribute.String("session_id", driverConfig.SessionID),
		attribute.String("client_id", cfg.Env["NOMAD_NODE_ID"]),
		attribute.Bool("edit_enabled", driverConfig.EditEnabled),
	)

	d.logger.Info("starting firecracker task", "driver_cfg", hclog.Fmt("%+v", driverConfig))
	handle := drivers.NewTaskHandle(taskHandleVersion)
	handle.Config = cfg

	ipSlot, err := CreateNamespaces(childCtx, cfg.Env["NOMAD_NODE_ID"], driverConfig.SessionID, d)
	if err != nil {
		ipSlot.RemoveNamespace(childCtx, d)
		errMsg := fmt.Errorf("failed to create namespaces: %v", err)

		d.ReportCriticalError(childCtx, errMsg)
		return nil, nil, errMsg
	}
	d.ReportEvent(childCtx, "created namespaces")

	m, err := d.initializeFC(
		childCtx,
		cfg,
		driverConfig,
		ipSlot,
		cfg.Env["FC_ENVS_DISK"],
		driverConfig.EditEnabled,
	)
	if err != nil {
		ipSlot.RemoveNamespace(childCtx, d)
		d.logger.Info("Error starting firecracker vm", "driver_cfg", hclog.Fmt("%+v", err))
		errMsg := fmt.Errorf("task with ID %q failed: %q", cfg.ID, err.Error())
		d.ReportCriticalError(childCtx, errMsg)
		return nil, nil, errMsg
	}
	d.ReportEvent(childCtx, "initialized FC")

	h := &taskHandle{
		ctx:             childCtx,
		taskConfig:      cfg,
		State:           drivers.TaskStateRunning,
		startedAt:       time.Now().Round(time.Millisecond),
		MachineInstance: m.Machine,
		Slot:            ipSlot,
		Info:            m.Info,
		EditEnabled:     driverConfig.EditEnabled,
		logger:          d.logger,
		cpuStatsSys:     stats.NewCpuStats(),
		cpuStatsUser:    stats.NewCpuStats(),
		cpuStatsTotal:   stats.NewCpuStats(),
	}

	driverState := TaskState{
		ContainerName: fmt.Sprintf("%s-%s", cfg.Name, cfg.AllocID),
		TaskConfig:    cfg,
		StartedAt:     h.startedAt,
	}

	if err = handle.SetDriverState(&driverState); err != nil {
		ipSlot.RemoveNamespace(childCtx, d)
		m.Machine.StopVMM()
		d.logger.Error("failed to start task, error setting driver state", "error", err)
		errMsg := fmt.Errorf("failed to set driver state: %v", err)
		d.ReportCriticalError(childCtx, errMsg)
		return nil, nil, errMsg
	}

	d.tasks.Set(cfg.ID, h)

	go h.run(childCtx, d)

	return handle, nil, nil
}

func (d *Driver) WaitTask(ctx context.Context, taskID string) (<-chan *drivers.ExitResult, error) {
	validationCtx, validationSpan := d.tracer.Start(ctx, "wait-session-task-validation", trace.WithAttributes(
		attribute.String("task_id", taskID),
	))
	defer validationSpan.End()

	h, ok := d.tasks.Get(taskID)
	if !ok {
		d.ReportCriticalError(validationCtx, drivers.ErrTaskNotFound)
		return nil, drivers.ErrTaskNotFound
	}

	childCtx, childSpan := d.tracer.Start(d.ctx, "wait-session-task",
		trace.WithAttributes(
			attribute.String("task_id", taskID),
		),
		trace.WithLinks(
			trace.LinkFromContext(validationCtx, attribute.String("link", "validation")),
			trace.LinkFromContext(h.ctx, attribute.String("link", "start-session-task")),
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
	ctx, span := d.tracer.Start(d.ctx, "stop-session-task-validation", trace.WithAttributes(
		attribute.String("task_id", taskID),
	))
	defer span.End()

	h, ok := d.tasks.Get(taskID)
	if !ok {
		d.ReportCriticalError(ctx, drivers.ErrTaskNotFound)
		return drivers.ErrTaskNotFound
	}

	childCtx, childSpan := d.tracer.Start(d.ctx, "stop-session-task",
		trace.WithAttributes(
			attribute.String("task_id", taskID),
		),
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
			trace.LinkFromContext(h.ctx, attribute.String("link", "start-session-task")),
		),
	)
	defer childSpan.End()

	if err := h.shutdown(childCtx, d); err != nil {
		errMsg := fmt.Errorf("executor Shutdown failed: %v", err)
		d.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	d.ReportEvent(childCtx, "shutdown task")

	return nil
}

func (d *Driver) DestroyTask(taskID string, force bool) error {
	ctx, span := d.tracer.Start(d.ctx, "destroy-session-task-validation", trace.WithAttributes(
		attribute.String("task_id", taskID),
	))
	defer span.End()

	h, ok := d.tasks.Get(taskID)
	if !ok {
		d.ReportCriticalError(ctx, drivers.ErrTaskNotFound)
		return drivers.ErrTaskNotFound
	}

	childCtx, childSpan := d.tracer.Start(d.ctx, "destroy-session-task",
		trace.WithAttributes(
			attribute.String("task_id", taskID),
		),
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
			trace.LinkFromContext(h.ctx, attribute.String("link", "start-session-task")),
		),
	)
	defer childSpan.End()

	if err := h.shutdown(childCtx, d); err != nil {
		errMsg := fmt.Errorf("executor Shutdown failed: %v", err)
		d.ReportCriticalError(childCtx, errMsg)
	}
	d.ReportEvent(childCtx, "shutdown task")

	h.Slot.RemoveNamespace(childCtx, d)

	d.tasks.Delete(taskID)
	d.ReportEvent(childCtx, "task deleted")

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
	return nil, fmt.Errorf("firecracker-task-driver does not support exec")
}

func (d *Driver) SignalTask(taskID string, signal string) error {
	return fmt.Errorf("firecracker-task-driver does not support signal")
}
