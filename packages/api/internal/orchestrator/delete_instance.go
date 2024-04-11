package orchestrator

import (
	"context"
	"fmt"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
)

func (o *Orchestrator) DeleteInstance(ctx context.Context, sandboxID string) error {
	_, err := o.grpc.Client.SandboxDelete(ctx, &orchestrator.SandboxRequest{
		SandboxID: sandboxID,
	})

	if err != nil {
		return fmt.Errorf("failed to delete sandbox '%s': %w", sandboxID, err)
	}

	return nil
}
