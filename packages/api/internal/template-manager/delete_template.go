package template_manager

import (
	"context"
	"fmt"
	"google.golang.org/grpc/status"

	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func (tm *TemplateManager) DeleteInstance(ctx context.Context, templateID string) error {
	_, err := tm.grpc.Client.TemplateDelete(ctx, &template_manager.TemplateDeleteRequest{
		TemplateID: templateID,
	})

	if err != nil {
		st, ok := status.FromError(err)
		if !ok {
			errMsg := fmt.Errorf("failed to delete template '%s': %w", templateID, err)
			telemetry.ReportCriticalError(ctx, errMsg)

			return fmt.Errorf("failed to delete template '%s': %w", templateID, err)
		}

		telemetry.ReportCriticalError(
			ctx,
			fmt.Errorf("failed to delete template '%s': [%s] %s", templateID, st.Code(), st.Message()),
		)
		return fmt.Errorf("failed to delete template '%s': %s", templateID, st.Message())
	}

	return nil
}
