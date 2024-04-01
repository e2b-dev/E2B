package internal

import (
	"context"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel"

	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/instance"
	"github.com/e2b-dev/infra/packages/shared/pkg/driver"
)

const (
	PluginName    = "env-instance-task-driver"
	PluginVersion = "0.2.0"
)

type DriverExtra struct {
	dns *instance.DNS
}

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

	configSpec := hclspec.NewObject(map[string]*hclspec.Spec{})

	dns, err := instance.NewDNS()
	if err != nil {
		panic(err)
	}

	return &driver.Driver[*DriverExtra, *driver.TaskHandle[*extraTaskHandle]]{
		Tracer:             tracer,
		Eventer:            eventer.NewEventer(ctx, logger),
		Config:             &driver.Config{},
		Ctx:                ctx,
		SignalShutdown:     cancel,
		Logger:             logger,
		Info:               pluginInfo,
		DriverCapabilities: capabilities,
		ConfigSpec:         configSpec,
		TaskConfigSpec:     taskConfigSpec,
		Tasks:              driver.NewTaskStore[*driver.TaskHandle[*extraTaskHandle]](),
		Extra: &DriverExtra{
			dns: dns,
		},
	}
}
