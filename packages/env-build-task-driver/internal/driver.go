package internal

import (
	"context"

	"github.com/docker/docker/client"
	docker "github.com/fsouza/go-dockerclient"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel"

	"github.com/e2b-dev/infra/packages/shared/pkg/driver"
)

const (
	PluginName    = "env-build-task-driver"
	PluginVersion = "0.2.0"
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

type DriverExtra struct {
	docker *client.Client

	legacyDockerClient *docker.Client
}

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

	return &driver.Driver[*DriverExtra, *taskHandle]{
		Tracer:             tracer,
		Eventer:            eventer.NewEventer(ctx, logger),
		Config:             &driver.Config{},
		Tasks:              driver.NewTaskStore[*taskHandle](),
		Ctx:                ctx,
		SignalShutdown:     cancel,
		Logger:             logger,
		ConfigSpec:         configSpec,
		Info:               pluginInfo,
		DriverCapabilities: capabilities,
		Extra: &DriverExtra{
			docker:             client,
			legacyDockerClient: legacyClient,
		},
	}
}
