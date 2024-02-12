package internal

import (
	"context"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"github.com/txn2/txeh"
	"go.opentelemetry.io/otel"

	"github.com/e2b-dev/infra/packages/shared/pkg/driver"
)

const (
	PluginName    = "env-instance-task-driver"
	PluginVersion = "0.2.0"
)

type DriverExtra struct {
	hosts *txeh.Hosts
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

	hosts, err := txeh.NewHostsDefault()
	if err != nil {
		panic("Failed to initialize etc hosts handler")
	}

	err = hosts.Reload()
	if err != nil {
		panic("Failed to load etc hosts")
	}

	return &driver.Driver[*DriverExtra, *taskHandle]{
		Tracer:             tracer,
		Eventer:            eventer.NewEventer(ctx, logger),
		Config:             &driver.Config{},
		Ctx:                ctx,
		SignalShutdown:     cancel,
		Logger:             logger,
		Info:               pluginInfo,
		DriverCapabilities: capabilities,
		ConfigSpec:         hclspec.NewObject(map[string]*hclspec.Spec{}),
		Tasks:              driver.NewTaskStore[*taskHandle](),
		Extra: &DriverExtra{
			hosts: hosts,
		},
	}
}
