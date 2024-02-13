package internal

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"syscall"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/instance"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

// Interval at which we check if the process is still running.
const processCheckInterval = 4 * time.Second

type extraTaskHandle struct {
	Instance *instance.Instance
}

func (h *extraTaskHandle) GetDriverAttributes() map[string]string {
	return map[string]string{
		"Pid": h.Instance.FC.Pid,
	}
}

func (h *extraTaskHandle) Run(_ context.Context, _ trace.Tracer) error {
	pid, err := strconv.Atoi(h.Instance.FC.Pid)
	if err != nil {
		errMsg := fmt.Errorf("ERROR Env-instance-task-driver Could not parse pid=%s after initialization", h.Instance.FC.Pid)
		return errMsg
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

	return nil
}

func (h *extraTaskHandle) shutdown(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "shutdown")
	defer childSpan.End()

	err := h.Instance.FC.Stop(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("failed to stop FC: %w", err)

		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}
	return nil
}
