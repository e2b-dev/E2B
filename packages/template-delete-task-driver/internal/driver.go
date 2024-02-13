package internal

import (
	"context"

	artifactregistry "cloud.google.com/go/artifactregistry/apiv1"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel"

	"github.com/e2b-dev/infra/packages/shared/pkg/driver"
)

const (
	PluginName    = "template-delete-task-driver"
	PluginVersion = "0.0.1"
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
	artifactRegistry *artifactregistry.Client
}

func NewPlugin(logger hclog.Logger) drivers.DriverPlugin {
	ctx, cancel := context.WithCancel(context.Background())
	logger = logger.Named(PluginName)

	tracer := otel.Tracer("driver")

	artifactRegistry, err := artifactregistry.NewClient(ctx)
	if err != nil {
		panic(err)
	}

	logger.Info("Initialized Artifact Registry client")

	return &driver.Driver[*DriverExtra, *driver.TaskHandle[*extraTaskHandle]]{
		Tracer:             tracer,
		Eventer:            eventer.NewEventer(ctx, logger),
		Config:             &driver.Config{},
		Tasks:              driver.NewTaskStore[*driver.TaskHandle[*extraTaskHandle]](),
		Ctx:                ctx,
		SignalShutdown:     cancel,
		Logger:             logger,
		TaskConfigSpec:     taskConfigSpec,
		ConfigSpec:         configSpec,
		Info:               pluginInfo,
		DriverCapabilities: capabilities,
		Extra: &DriverExtra{
			artifactRegistry: artifactRegistry,
		},
	}
}
