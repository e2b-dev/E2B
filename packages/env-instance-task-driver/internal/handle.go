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

	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/instance"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

type taskHandle struct {
	ctx    context.Context
	logger hclog.Logger
	// TODO: The mutext here causes deadlock when we are stopping tasks
	// For now we are not using it - the relevant data will be still valid (FC running/exit).
	// mu syncs access to all fields below
	mu sync.RWMutex

	taskConfig            *drivers.TaskConfig
	State                 drivers.TaskState
	MachineInstance       *firecracker.Machine
	Slot                  *instance.IPSlot
	EnvInstanceFilesystem *instance.InstanceFilesystem
	EnvInstance           Instance
	ConsulToken           string
	startedAt             time.Time
	completedAt           time.Time
	exitResult            *drivers.ExitResult
}

func (h *taskHandle) TaskStatus() *drivers.TaskStatus {
	h.mu.RLock()
	defer h.mu.RUnlock()

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
		h.mu.Lock()
		h.exitResult = &drivers.ExitResult{}
		h.exitResult.ExitCode = 127
		h.exitResult.Signal = 0
		h.completedAt = time.Now()
		h.State = drivers.TaskStateExited
		h.mu.Unlock()
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

	telemetry.ReportEvent(childCtx, "waiting for state lock")
	h.mu.Lock()
	defer h.mu.Unlock()
	telemetry.ReportEvent(childCtx, "passed state lock")

	h.exitResult = &drivers.ExitResult{}
	h.exitResult.ExitCode = 0
	h.exitResult.Signal = 0
	h.completedAt = time.Now()
	h.State = drivers.TaskStateExited
	telemetry.ReportEvent(childCtx, "updated task exit info")

	return nil
}
