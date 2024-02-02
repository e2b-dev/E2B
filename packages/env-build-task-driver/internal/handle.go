package internal

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/docker/docker/client"
	docker "github.com/fsouza/go-dockerclient"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/api"
	"github.com/hashicorp/nomad/plugins/drivers"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/env-build-task-driver/internal/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

type taskHandle struct {
	logger      hclog.Logger
	taskConfig  *drivers.TaskConfig
	taskState   drivers.TaskState
	exitResult  *drivers.ExitResult
	startedAt   time.Time
	completedAt time.Time

	env *env.Env

	exited chan struct{}

	ctx    context.Context
	cancel context.CancelFunc

	mu sync.RWMutex
}

func (h *taskHandle) TaskStatus() *drivers.TaskStatus {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return &drivers.TaskStatus{
		ID:               h.taskConfig.ID,
		Name:             h.taskConfig.Name,
		State:            h.taskState,
		StartedAt:        h.startedAt,
		CompletedAt:      h.completedAt,
		ExitResult:       h.exitResult,
		DriverAttributes: map[string]string{},
	}
}

func (h *taskHandle) IsRunning() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return h.taskState == drivers.TaskStateRunning
}

func (h *taskHandle) handleResult(err error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if err != nil {
		h.exitResult = &drivers.ExitResult{
			Err:      err,
			ExitCode: 1,
		}
	} else {
		h.exitResult = &drivers.ExitResult{
			ExitCode: 0,
		}
	}

	h.completedAt = time.Now()
	h.taskState = drivers.TaskStateExited

	close(h.exited)
}

func (h *taskHandle) run(ctx context.Context, tracer trace.Tracer, docker *client.Client, legacyDocker *docker.Client, nomadToken string) {
	childCtx, childSpan := tracer.Start(ctx, "run")
	defer childSpan.End()

	err := h.env.Build(childCtx, tracer, docker, legacyDocker)
	if err != nil {
		h.logger.Error(fmt.Sprintf("error during building env '%s' with build id '%s': %s", h.env.EnvID, h.env.BuildID, err.Error()))
		telemetry.ReportCriticalError(childCtx, err)

		h.handleResult(err)

		return
	}

	config := api.DefaultConfig()
	config.SecretID = nomadToken
	nomadClient, err := api.NewClient(config)
	if err != nil {
		errMsg := fmt.Errorf("error creating nomad client %w", err)
		h.logger.Error(fmt.Sprintf("error during building env '%s' with build id '%s': %s", h.env.EnvID, h.env.BuildID, errMsg.Error()))
		telemetry.ReportCriticalError(childCtx, errMsg)

		h.handleResult(errMsg)

		return
	}

	variable := &api.Variable{
		Path:  "env-build/disk-size-mb/" + h.env.EnvID,
		Items: api.VariableItems{h.env.BuildID: fmt.Sprintf("%d", h.env.RootfsSize>>env.ToMBShift)},
	}
	_, _, err = nomadClient.Variables().Create(variable, nil)
	if err != nil {
		errMsg := fmt.Errorf("error creating nomad variable %w", err)
		h.logger.Error(fmt.Sprintf("error during building env '%s' with build id '%s': %s", h.env.EnvID, h.env.BuildID, errMsg.Error()))
		telemetry.ReportCriticalError(childCtx, errMsg)

		h.handleResult(errMsg)

		return
	}

	h.logger.Info(fmt.Sprintf("building env '%s' with build id '%s' successful", h.env.EnvID, h.env.BuildID))

	h.handleResult(nil)
}
