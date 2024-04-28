package template_manager

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
)

func (tm *TemplateManager) DeleteInstance(ctx context.Context, templateID string) error {
	_, err := tm.grpc.Client.TemplateDelete(ctx, &template_manager.TemplateDeleteRequest{
		TemplateID: templateID,
	})

	err = utils.UnwrapGRPCError(err)
	if err != nil {
		return fmt.Errorf("failed to delete template '%s': %w", templateID, err)
	}

	return nil
}
