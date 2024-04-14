package orchestrator

import (
	"context"
	"fmt"

	"google.golang.org/grpc/status"

	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func (o *Orchestrator) DeleteInstance(ctx context.Context, sandboxID string) error {
	_, err := o.grpc.Client.SandboxDelete(ctx, &orchestrator.SandboxRequest{
		SandboxID: sandboxID,
	})

	if err != nil {
		st, ok := status.FromError(err)
		if !ok {
			errMsg := fmt.Errorf("failed to delete sandbox '%s': %w", sandboxID, err)
			telemetry.ReportCriticalError(ctx, errMsg)

			return fmt.Errorf("failed to delete sandbox '%s': %w", sandboxID, err)
		}

		telemetry.ReportCriticalError(
			ctx,
			fmt.Errorf("failed to delete sandbox '%s': [%s] %s", sandboxID, st.Code(), st.Message()),
		)
		return fmt.Errorf("failed to delete sandbox '%s': %s", sandboxID, st.Message())
	}

	return nil
}
