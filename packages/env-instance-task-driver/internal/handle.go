package internal

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"sync"
	"syscall"
	"time"

	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"

	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/env"
	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/slot"
	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/telemetry"
)

type taskHandle struct {
	ctx    context.Context
	logger hclog.Logger
	// TODO: The mutext here causes deadlock when we are stopping tasks
	// For now we are not using it - the relevant data will be still valid (FC running/exit).
	// stateLock syncs access to all fields below
	stateLock sync.RWMutex

	taskConfig            *drivers.TaskConfig
	State                 drivers.TaskState
	MachineInstance       *firecracker.Machine
	Slot                  *slot.IPSlot
	EnvInstanceFilesystem *env.InstanceFilesystem
	EnvInstance           Instance
	ConsulToken           string
	startedAt             time.Time
	completedAt           time.Time
	exitResult            *drivers.ExitResult
}

func (h *taskHandle) TaskStatus() *drivers.TaskStatus {
	h.stateLock.RLock()
	defer h.stateLock.RUnlock()

	return &drivers.TaskStatus{
		ID:          h.taskConfig.ID,
		Name:        h.taskConfig.Name,
		State:       h.State,
		StartedAt:   h.startedAt,
		CompletedAt: h.completedAt,
		ExitResult:  h.exitResult,
		DriverAttributes: map[string]string{
			"Pid": h.EnvInstance.Pid,
		},
	}
}

func (h *taskHandle) run(ctx context.Context, driver *Driver) {
	pid, err := strconv.Atoi(h.EnvInstance.Pid)
	if err != nil {
		h.logger.Info(fmt.Sprintf("ERROR Env-instance-task-driver Could not parse pid=%s after initialization", h.EnvInstance.Pid))
		h.stateLock.Lock()
		h.exitResult = &drivers.ExitResult{}
		h.exitResult.ExitCode = 127
		h.exitResult.Signal = 0
		h.completedAt = time.Now()
		h.State = drivers.TaskStateExited
		h.stateLock.Unlock()
		return
	}

	for {
		time.Sleep(containerMonitorIntv)

		process, err := os.FindProcess(int(pid))
		if err != nil {
			break
		}

		if process.Signal(syscall.Signal(0)) != nil {
			break
		}
	}
}

func (h *taskHandle) stats(ctx context.Context, statsChannel chan *drivers.TaskResourceUsage, interval time.Duration) {
	defer close(statsChannel)
	timer := time.NewTimer(0)
	h.logger.Debug("Starting stats collection for ", h.taskConfig.ID)
	for {
		select {
		case <-ctx.Done():
			h.logger.Debug("Stopping stats collection for ", h.taskConfig.ID)
			return
		case <-timer.C:
			timer.Reset(interval)
		}
	}
}

func (h *taskHandle) shutdown(ctx context.Context, driver *Driver) error {
	childCtx, childSpan := driver.tracer.Start(ctx, "shutdown")
	defer childSpan.End()

	h.EnvInstance.Cmd.Process.Signal(syscall.SIGTERM)
	telemetry.ReportEvent(childCtx, "sent SIGTERM to FC process")

	pid, pErr := strconv.Atoi(h.EnvInstance.Pid)
	if pErr == nil {
		timeout := time.After(10 * time.Second)

	pidCheck:
		for {
			select {
			case <-timeout:
				h.EnvInstance.Cmd.Process.Kill()
				break pidCheck
			default:
				process, err := os.FindProcess(int(pid))
				if err != nil {
					break pidCheck
				}

				if process.Signal(syscall.Signal(0)) != nil {
					break pidCheck
				}
			}
			time.Sleep(containerMonitorIntv)
		}
	}

	// TODO: Ensure the pipes are closed by this point
	_, err := h.EnvInstance.Cmd.Process.Wait()
	if err != nil {
		errMsg := fmt.Errorf("error waiting for FC process end %w", err)
		telemetry.ReportError(childCtx, errMsg)
	}

	telemetry.ReportEvent(childCtx, "waiting for state lock")
	h.stateLock.Lock()
	defer h.stateLock.Unlock()
	telemetry.ReportEvent(childCtx, "passed state lock")

	h.exitResult = &drivers.ExitResult{}
	h.exitResult.ExitCode = 0
	h.exitResult.Signal = 0
	h.completedAt = time.Now()
	h.State = drivers.TaskStateExited
	telemetry.ReportEvent(childCtx, "updated task exit info")

	return nil
}
