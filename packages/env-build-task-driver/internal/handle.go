package internal

import (
	"context"
	"sync"
	"time"

	"github.com/docker/docker/client"
	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/env"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin"
	"github.com/hashicorp/nomad/plugins/drivers"
	"go.opentelemetry.io/otel/trace"
)

type taskHandle struct {
	stateLock sync.RWMutex

	env *env.Env

	logger       hclog.Logger
	pluginClient *plugin.Client
	taskConfig   *drivers.TaskConfig
	procState    drivers.TaskState
	startedAt    time.Time
	completedAt  time.Time
	exitResult   *drivers.ExitResult
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
	childCtx, childSpan := tracer.Start(ctx, "run-build")
	defer childSpan.End()

	h.stateLock.Lock()
	if h.exitResult == nil {
		h.exitResult = &drivers.ExitResult{}
	}
	h.stateLock.Unlock()

	err := h.env.Initialize()
	if err != nil {
		h.stateLock.Lock()
		defer h.stateLock.Unlock()
		h.exitResult.Err = err
		h.procState = drivers.TaskStateUnknown
		h.completedAt = time.Now()
		return
	}
	defer h.env.MoveToEnvDir()
	defer h.env.Cleanup()

	rootfs, err := env.NewRootfs(ctx, tracer, h.env, docker)
	if err != nil {
		h.stateLock.Lock()
		defer h.stateLock.Unlock()
		h.exitResult.Err = err
		h.procState = drivers.TaskStateUnknown
		h.completedAt = time.Now()
		return
	}
	defer rootfs.Cleanup()

	network, err := env.NewFCNetwork(ctx, tracer, h.env)
	if err != nil {
		h.stateLock.Lock()
		defer h.stateLock.Unlock()
		h.exitResult.Err = err
		h.procState = drivers.TaskStateUnknown
		h.completedAt = time.Now()
		return
	}
	defer network.Cleanup(childCtx, tracer)

	snapshot, err := env.NewSnapshot(ctx, tracer, h.env, network, rootfs)
	if err != nil {
		h.stateLock.Lock()
		defer h.stateLock.Unlock()
		h.exitResult.Err = err
		h.procState = drivers.TaskStateUnknown
		h.completedAt = time.Now()
		return
	}
	defer snapshot.Cleanup(childCtx, tracer)

	h.stateLock.Lock()
	defer h.stateLock.Unlock()

	h.procState = drivers.TaskStateExited
	h.exitResult.ExitCode = 0
	h.completedAt = time.Now()
}
