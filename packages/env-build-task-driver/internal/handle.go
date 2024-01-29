package internal

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/docker/docker/client"
	docker "github.com/fsouza/go-dockerclient"
	"github.com/hashicorp/go-hclog"
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

func (h *taskHandle) run(ctx context.Context, tracer trace.Tracer, docker *client.Client, legacyDocker *docker.Client) {
	childCtx, childSpan := tracer.Start(ctx, "run")
	defer childSpan.End()

	err := h.env.Build(childCtx, tracer, docker, legacyDocker)
	if err != nil {
		telemetry.ReportCriticalError(childCtx, err)

		h.logger.Error(fmt.Sprintf("error during building env '%s' with build id '%s': %s", h.env.EnvID, h.env.BuildID, err.Error()))

		h.mu.Lock()

		h.exitResult = &drivers.ExitResult{
			Err:      err,
			ExitCode: 1,
		}
		h.taskState = drivers.TaskStateExited
		h.completedAt = time.Now()

		h.mu.Unlock()
	} else {
		h.logger.Info(fmt.Sprintf("building env '%s' with build id '%s' successful", h.env.EnvID, h.env.BuildID))
		h.mu.Lock()

		h.exitResult = &drivers.ExitResult{
			ExitCode: 0,
		}

		h.completedAt = time.Now()
		h.taskState = drivers.TaskStateExited

		h.mu.Unlock()
	}

	h.mu.Lock()
	close(h.exited)
	h.mu.Unlock()
}
