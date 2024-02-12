package driver

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

type extraTaskHandle interface {
	GetDriverAttributes() map[string]string
	Run(ctx context.Context, tracer trace.Tracer) error
}

type TaskHandle[Extra extraTaskHandle] struct {
	Logger      hclog.Logger
	TaskConfig  *drivers.TaskConfig
	TaskState   drivers.TaskState
	ExitResult  *drivers.ExitResult
	StartedAt   time.Time
	CompletedAt time.Time

	Extra Extra

	Exited chan struct{}

	Ctx    context.Context
	Cancel context.CancelFunc

	Mu sync.RWMutex
}

func (h *TaskHandle[Extra]) TaskStatus() *drivers.TaskStatus {
	h.Mu.RLock()
	defer h.Mu.RUnlock()

	return &drivers.TaskStatus{
		ID:               h.TaskConfig.ID,
		Name:             h.TaskConfig.Name,
		State:            h.TaskState,
		StartedAt:        h.StartedAt,
		CompletedAt:      h.CompletedAt,
		ExitResult:       h.ExitResult,
		DriverAttributes: h.Extra.GetDriverAttributes(),
	}
}

func (h *TaskHandle[Extra]) IsRunning() bool {
	h.Mu.RLock()
	defer h.Mu.RUnlock()

	return h.TaskState == drivers.TaskStateRunning
}

func (h *TaskHandle[Extra]) handleResult(err error) {
	h.Mu.Lock()
	defer h.Mu.Unlock()

	if err != nil {
		h.ExitResult = &drivers.ExitResult{
			Err:      err,
			ExitCode: 1,
		}
	} else {
		h.ExitResult = &drivers.ExitResult{
			ExitCode: 0,
		}
	}

	h.CompletedAt = time.Now()
	h.TaskState = drivers.TaskStateExited

	close(h.Exited)
}

func (h *TaskHandle[Extra]) Run(ctx context.Context, tracer trace.Tracer) {
	childCtx, childSpan := tracer.Start(ctx, "run")
	defer childSpan.End()

	err := h.Extra.Run(childCtx, tracer)
	if err != nil {
		h.Logger.Error(fmt.Sprintf("error running driver: %s", err.Error()))
		telemetry.ReportCriticalError(childCtx, err)

		h.handleResult(err)

		return
	}

	h.handleResult(nil)
}
