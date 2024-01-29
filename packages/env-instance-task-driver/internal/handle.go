package internal

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"sync"
	"syscall"
	"time"

	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"

	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/instance"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

// Interval at which we check if the process is still running.
const processCheckInterval = 4 * time.Second

type taskHandle struct {
	Instance *instance.Instance

	logger      hclog.Logger
	taskConfig  *drivers.TaskConfig
	taskState   drivers.TaskState
	exitResult  *drivers.ExitResult
	startedAt   time.Time
	completedAt time.Time

	exited chan struct{}

	ctx    context.Context
	cancel context.CancelFunc

	mu sync.RWMutex
}

func (h *taskHandle) TaskStatus() *drivers.TaskStatus {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return &drivers.TaskStatus{
		ID:          h.taskConfig.ID,
		Name:        h.taskConfig.Name,
		State:       h.taskState,
		StartedAt:   h.startedAt,
		CompletedAt: h.completedAt,
		ExitResult:  h.exitResult,
		DriverAttributes: map[string]string{
			"Pid": h.Instance.FC.Pid,
		},
	}
}

func (h *taskHandle) run(ctx context.Context, driver *Driver) {
	pid, err := strconv.Atoi(h.Instance.FC.Pid)
	if err != nil {
		h.logger.Info(fmt.Sprintf("ERROR Env-instance-task-driver Could not parse pid=%s after initialization", h.Instance.FC.Pid))
		h.mu.Lock()
		h.exitResult = &drivers.ExitResult{}
		h.exitResult.ExitCode = 127
		h.exitResult.Signal = 0
		h.completedAt = time.Now()
		h.taskState = drivers.TaskStateExited
		h.mu.Unlock()
		return
	}

	for {
		time.Sleep(processCheckInterval)

		process, err := os.FindProcess(int(pid))
		if err != nil {
			break
		}

		if process.Signal(syscall.Signal(0)) != nil {
			break
		}
	}
}

func (h *taskHandle) shutdown(ctx context.Context, driver *Driver) error {
	childCtx, childSpan := driver.tracer.Start(ctx, "shutdown")
	defer childSpan.End()

	err := h.Instance.FC.Stop(childCtx, driver.tracer)
	if err != nil {
		errMsg := fmt.Errorf("failed to stop FC: %w", err)

		telemetry.ReportCriticalError(childCtx, errMsg)

		h.mu.Lock()
		h.exitResult = &drivers.ExitResult{}
		h.exitResult.ExitCode = 1
		h.exitResult.Signal = 0
		h.completedAt = time.Now()
		h.taskState = drivers.TaskStateUnknown
		h.exitResult.Err = errMsg
		h.mu.Unlock()

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "waiting for state lock")

	h.mu.Lock()
	h.exitResult = &drivers.ExitResult{}
	h.exitResult.ExitCode = 0
	h.exitResult.Signal = 0
	h.completedAt = time.Now()
	h.taskState = drivers.TaskStateExited
	h.mu.Unlock()

	telemetry.ReportEvent(childCtx, "updated task exit info")

	return nil
}
