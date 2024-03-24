package driver

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/client/structs"
	"github.com/hashicorp/nomad/drivers/shared/eventer"
	"github.com/hashicorp/nomad/plugins/base"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/hclspec"
	"go.opentelemetry.io/otel/trace"
)

type (
	Config          struct{}
	HandleInterface interface {
		TaskStatus() *drivers.TaskStatus
	}
)

type ExtraDriver[TaskHandle HandleInterface] interface {
	StartTask(cfg *drivers.TaskConfig, ctx context.Context, tracer trace.Tracer, tasks *TaskStore[TaskHandle], logger hclog.Logger) (*drivers.TaskHandle, *drivers.DriverNetwork, error)
	WaitTask(ctx context.Context, driverCtx context.Context, tracer trace.Tracer, tasks *TaskStore[TaskHandle], logger hclog.Logger, taskID string) (<-chan *drivers.ExitResult, error)
	StopTask(ctx context.Context, tracer trace.Tracer, tasks *TaskStore[TaskHandle], logger hclog.Logger, taskID string, timeout time.Duration, signal string) error
	DestroyTask(ctx context.Context, tracer trace.Tracer, tasks *TaskStore[TaskHandle], logger hclog.Logger, taskID string, force bool) error
	TaskStats(ctx context.Context, driverCtx context.Context, tracer trace.Tracer, tasks *TaskStore[TaskHandle], taskID string, interval time.Duration) (<-chan *structs.TaskResourceUsage, error)
}

type Driver[Extra ExtraDriver[TaskHandle], TaskHandle HandleInterface] struct {
	// Eventer is used to handle multiplexing of TaskEvents calls such that an
	// event can be broadcast to all callers
	Eventer *eventer.Eventer

	Tracer trace.Tracer

	// config is the driver configuration set by the SetConfig RPC
	Config *Config

	// ctx is the context for the driver. It is passed to other subsystems to
	// coordinate shutdown
	Ctx context.Context

	// signalShutdown is called when the driver is shutting down and cancels the
	// ctx passed to any subsystems
	SignalShutdown context.CancelFunc

	// logger will log to the Nomad agent
	Logger hclog.Logger

	// Info is the plugin information for the driver
	Info *base.PluginInfoResponse

	// DriverCapabilities is the capabilities of the driver
	DriverCapabilities *drivers.Capabilities

	// TaskConfigSpec is the schema for the task configuration
	TaskConfigSpec *hclspec.Spec

	// configSpec is the schema for the driver configuration
	ConfigSpec *hclspec.Spec

	// nomadConfig is the client config from nomad
	NomadConfig *base.ClientDriverConfig

	// Tasks is the in memory datastore mapping taskIDs to rawExecDriverHandles
	Tasks TaskStore[TaskHandle]

	// Extra are any other attributes the specific driver needs
	Extra Extra

	drivers.DriverExecTaskNotSupported
	drivers.DriverSignalTaskNotSupported
}

func (d *Driver[Extra, TaskHandle]) TaskConfigSchema() (*hclspec.Spec, error) {
	return d.TaskConfigSpec, nil
}

func (d *Driver[Extra, TaskHandle]) RecoverTask(handle *drivers.TaskHandle) error {
	if handle == nil {
		return errors.New("error: handle cannot be nil")
	}

	return fmt.Errorf("recover task not implemented")
}

func (d *Driver[Extra, TaskHandle]) StartTask(config *drivers.TaskConfig) (*drivers.TaskHandle, *drivers.DriverNetwork, error) {
	return d.Extra.StartTask(config, d.Ctx, d.Tracer, &d.Tasks, d.Logger)
}

func (d *Driver[Extra, TaskHandle]) WaitTask(ctx context.Context, taskID string) (<-chan *drivers.ExitResult, error) {
	return d.Extra.WaitTask(ctx, d.Ctx, d.Tracer, &d.Tasks, d.Logger, taskID)
}

func (d *Driver[Extra, TaskHandle]) StopTask(taskID string, timeout time.Duration, signal string) error {
	return d.Extra.StopTask(d.Ctx, d.Tracer, &d.Tasks, d.Logger, taskID, timeout, signal)
}

func (d *Driver[Extra, TaskHandle]) DestroyTask(taskID string, force bool) error {
	return d.Extra.DestroyTask(d.Ctx, d.Tracer, &d.Tasks, d.Logger, taskID, force)
}

func (d *Driver[Extra, TaskHandle]) InspectTask(taskID string) (*drivers.TaskStatus, error) {
	handle, ok := d.Tasks.Get(taskID)

	if !ok {
		return nil, drivers.ErrTaskNotFound
	}

	return handle.TaskStatus(), nil
}

func (d *Driver[Extra, TaskHandle]) TaskStats(ctx context.Context, taskID string, interval time.Duration) (<-chan *structs.TaskResourceUsage, error) {
	return d.Extra.TaskStats(ctx, d.Ctx, d.Tracer, &d.Tasks, taskID, interval)
}

func (d *Driver[Extra, TaskHandle]) TaskEvents(ctx context.Context) (<-chan *drivers.TaskEvent, error) {
	return d.Eventer.TaskEvents(ctx)
}

func (d *Driver[Extra, TaskHandle]) PluginInfo() (*base.PluginInfoResponse, error) {
	return d.Info, nil
}

func (d *Driver[Extra, TaskHandle]) ConfigSchema() (*hclspec.Spec, error) {
	return d.ConfigSpec, nil
}

func (d *Driver[Extra, TaskHandle]) SetConfig(cfg *base.Config) error {
	var config Config
	if len(cfg.PluginConfig) != 0 {
		if err := base.MsgPackDecode(cfg.PluginConfig, &config); err != nil {
			return err
		}
	}

	d.Config = &config
	if cfg.AgentConfig != nil {
		d.NomadConfig = cfg.AgentConfig.Driver
	}

	return nil
}

func (d *Driver[Extra, TaskHandle]) Capabilities() (*drivers.Capabilities, error) {
	return d.DriverCapabilities, nil
}
