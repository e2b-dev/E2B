package orchestrator

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
)

func (o *Orchestrator) DeleteInstance(ctx context.Context, tracer trace.Tracer, sandboxID string) error {
	childCtx, childSpan := tracer.Start(ctx, "delete-instance")
	defer childSpan.End()

	_, err := o.grpc.Sandbox.Delete(childCtx, &orchestrator.SandboxRequest{
		SandboxID: sandboxID,
	})

	err = utils.UnwrapGRPCError(err)
	if err != nil {
		return fmt.Errorf("failed to delete sandbox '%s': %w", sandboxID, err)
	}

	return nil
}
