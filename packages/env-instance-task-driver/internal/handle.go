package internal

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/instance"
	"github.com/hashicorp/nomad/plugins/drivers"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

type extraTaskHandle struct {
	Instance *instance.Instance
}

func (h *extraTaskHandle) GetDriverAttributes() map[string]string {
	return map[string]string{
		"Pid": h.Instance.FC.Pid,
	}
}

func (h *extraTaskHandle) Run(ctx context.Context, _ trace.Tracer) error {
	return h.Instance.FC.Machine.Wait(ctx)
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

func (h *extraTaskHandle) Stats(ctx context.Context, statsChannel chan *drivers.TaskResourceUsage, interval time.Duration) {
	defer close(statsChannel)
	<-ctx.Done()
}
