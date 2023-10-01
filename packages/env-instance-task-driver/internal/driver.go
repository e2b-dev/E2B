package internal

import (
	"context"

	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"github.com/txn2/txeh"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

const (
	PluginName    = "env-instance-task-driver"
	PluginVersion = "0.2.0"
)

type (
	Config struct{}

	Driver struct {
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

		drivers.DriverExecTaskNotSupported
		drivers.DriverSignalTaskNotSupported
	}
)

var (
	pluginInfo = &base.PluginInfoResponse{
		Type:              base.PluginTypeDriver,
		PluginApiVersions: []string{drivers.ApiVersion010},
		PluginVersion:     PluginVersion,
		Name:              PluginName,
	}

	capabilities = &drivers.Capabilities{
		SendSignals: false,
		Exec:        false,
	}
)

func NewPlugin(logger hclog.Logger) drivers.DriverPlugin {
	ctx, cancel := context.WithCancel(context.Background())
	logger = logger.Named(PluginName)
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

func (d *Driver) Capabilities() (*drivers.Capabilities, error) {
	return capabilities, nil
}
