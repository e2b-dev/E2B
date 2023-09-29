package internal

import (
	"context"
	"time"

	"github.com/docker/docker/client"
	"github.com/e2b-dev/infra/packages/env-build-task-driver/internal/telemetry"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const (
	pluginName    = "env-build-task-driver"
	pluginVersion = "0.2.0"
)

type (
	Config struct{}

	TaskConfig struct {
		BuildID string `codec:"BuildID"`
		EnvID   string `codec:"EnvID"`

		SpanID  string `codec:"SpanID"`
		TraceID string `codec:"TraceID"`

		VCpuCount  int64 `codec:"VCpuCount"`
		MemoryMB   int64 `codec:"MemoryMB"`
		DiskSizeMB int64 `codec:"DiskSizeMB"`
	}

	TaskState struct {
		TaskConfig *drivers.TaskConfig
		StartedAt  time.Time
	}

	Driver struct {
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

		drivers.DriverExecTaskNotSupported
		drivers.DriverSignalTaskNotSupported
	}
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

func NewPlugin(logger hclog.Logger) drivers.DriverPlugin {
	ctx, cancel := context.WithCancel(context.Background())
	logger = logger.Named(pluginName)

	tracer := otel.Tracer("driver")

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

func (taskConfig *TaskConfig) getContextFromRemote(ctx context.Context, tracer trace.Tracer, name string) (context.Context, trace.Span) {
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

	return tracer.Start(
		trace.ContextWithRemoteSpanContext(ctx, remoteCtx),
		"start-task",
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
		),
	)
}
