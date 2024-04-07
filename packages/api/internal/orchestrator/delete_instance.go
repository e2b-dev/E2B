package orchestrator

import (
	"context"
	"fmt"
	"net/http"
)

func (o *Orchestrator) DeleteInstance(ctx context.Context, instanceID string) error {
	res, err := o.client.DeleteSandboxesSandboxID(ctx, instanceID)
	if err != nil {
		return fmt.Errorf("failed to delete sandbox '%s': %w", instanceID, err)
	}

	if res == nil {
		return fmt.Errorf("failed to delete sandbox '%s'", instanceID)
	}

	if res.StatusCode != http.StatusNoContent {
		return fmt.Errorf("failed to delete sandbox '%s': %s", instanceID, res.Status)
	}

	return nil
}
