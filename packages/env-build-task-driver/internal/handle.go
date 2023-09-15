package internal

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/docker/docker/client"
	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/env"
	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/telemetry"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"
	"go.opentelemetry.io/otel/trace"
)

type taskHandle struct {
	stateLock sync.RWMutex

	env *env.Env

	logger      hclog.Logger
	taskConfig  *drivers.TaskConfig
	procState   drivers.TaskState
	startedAt   time.Time
	completedAt time.Time
	exitResult  *drivers.ExitResult

	cancel context.CancelFunc

	exited chan struct{}
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

	failTask := func(err error) {
		h.stateLock.Lock()
		defer h.stateLock.Unlock()
		h.exitResult.Err = err
		h.procState = drivers.TaskStateExited
		h.completedAt = time.Now()
	}

	err := h.env.Initialize(childCtx, tracer)
	if err != nil {
		failTask(err)
		return
	}
	defer func() {
		cleanupErr := h.env.Cleanup()
		if cleanupErr != nil {
			errMsg := fmt.Errorf("error cleaning up env initialization %v", cleanupErr)
			telemetry.ReportError(ctx, errMsg)
		}
	}()

	rootfs, err := env.NewRootfs(ctx, tracer, h.env, docker)
	if err != nil {
		failTask(err)
		return
	}
	defer func() {
		cleanupErr := rootfs.Cleanup()
		if cleanupErr != nil {
			errMsg := fmt.Errorf("error cleaning up rootfs %v", cleanupErr)
			telemetry.ReportError(ctx, errMsg)
		}
	}()

	network, err := env.NewFCNetwork(ctx, tracer, h.env)
	if err != nil {
		failTask(err)
		return
	}
	defer func() {
		cleanupErr := network.Cleanup(childCtx, tracer)
		if cleanupErr != nil {
			errMsg := fmt.Errorf("error cleaning up env network %v", cleanupErr)
			telemetry.ReportError(ctx, errMsg)
		}
	}()

	snapshot, err := env.NewSnapshot(ctx, tracer, h.env, network, rootfs)
	if err != nil {
		failTask(err)
		return
	}
	defer func() {
		cleanupErr := snapshot.Cleanup(childCtx, tracer)
		if cleanupErr != nil {
			errMsg := fmt.Errorf("error cleaning up env snapshot %v", cleanupErr)
			telemetry.ReportError(ctx, errMsg)
		}
	}()

	err = h.env.MoveSnapshotToEnvDir()
	if err != nil {
		failTask(err)
		return
	}

	h.stateLock.Lock()
	defer h.stateLock.Unlock()

	h.procState = drivers.TaskStateExited
	h.exitResult.ExitCode = 0
	h.completedAt = time.Now()
}
