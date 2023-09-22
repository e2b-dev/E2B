package internal

import (
	"context"
	"sync"
	"time"

	"github.com/docker/docker/client"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/env"
	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/telemetry"
)

type taskHandle struct {
	logger      hclog.Logger
	taskConfig  *drivers.TaskConfig
	procState   drivers.TaskState
	exitResult  *drivers.ExitResult
	startedAt   time.Time
	completedAt time.Time

	cancel context.CancelFunc

	env *env.Env

	exited chan struct{}

	stateLock sync.RWMutex
}

func (h *taskHandle) TaskStatus() *drivers.TaskStatus {
	h.stateLock.RLock()
	defer h.stateLock.RUnlock()

	return &drivers.TaskStatus{
		ID:               h.taskConfig.ID,
		Name:             h.taskConfig.Name,
		State:            h.procState,
		StartedAt:        h.startedAt,
		CompletedAt:      h.completedAt,
		ExitResult:       h.exitResult,
		DriverAttributes: map[string]string{},
	}
}

func (h *taskHandle) IsRunning() bool {
	h.stateLock.RLock()
	defer h.stateLock.RUnlock()
	return h.procState == drivers.TaskStateRunning
}

func (h *taskHandle) run(ctx context.Context, tracer trace.Tracer, docker *client.Client) {
	childCtx, childSpan := tracer.Start(ctx, "run")
	defer childSpan.End()

	defer func() {
		h.stateLock.Lock()
		close(h.exited)
		h.stateLock.Unlock()
	}()

	h.stateLock.Lock()
	if h.exitResult == nil {
		h.exitResult = &drivers.ExitResult{}
	}
	h.stateLock.Unlock()

	err := h.env.Build(childCtx, tracer, docker)
	if err != nil {
		h.stateLock.Lock()

		h.exitResult.Err = err
		h.procState = drivers.TaskStateExited
		h.completedAt = time.Now()

		telemetry.ReportCriticalError(childCtx, err)

		h.stateLock.Unlock()
	}

	h.stateLock.Lock()

	h.procState = drivers.TaskStateExited
	h.exitResult.ExitCode = 0
	h.completedAt = time.Now()

	h.stateLock.Unlock()
}
