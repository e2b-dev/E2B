package internal

import (
	"context"
	"github.com/hashicorp/go-hclog"

	"github.com/docker/docker/client"
	docker "github.com/fsouza/go-dockerclient"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

const (
	PluginName    = "env-delete-task-driver"
	PluginVersion = "0.2.0"
)

type (
	Config struct{}

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

		legacyDockerClient *docker.Client

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

	configSpec = hclspec.NewObject(map[string]*hclspec.Spec{})

	capabilities = &drivers.Capabilities{
		SendSignals: false,
		Exec:        false,
	}
)

func NewPlugin(logger hclog.Logger) drivers.DriverPlugin {
	ctx, cancel := context.WithCancel(context.Background())
	logger = logger.Named(PluginName)

	tracer := otel.Tracer("driver")

	client, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		panic(err)
	}

	legacyClient, err := docker.NewClientFromEnv()
	if err != nil {
		panic(err)
	}

	return &Driver{
		tracer:             tracer,
		docker:             client,
		legacyDockerClient: legacyClient,
		eventer:            eventer.NewEventer(ctx, logger),
		config:             &Config{},
		tasks:              newTaskStore(),
		ctx:                ctx,
		signalShutdown:     cancel,
		logger:             logger,
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

func (d *Driver) Capabilities() (*drivers.Capabilities, error) {
	return capabilities, nil
}
