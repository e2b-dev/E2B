package handlers

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/gin-gonic/gin"
)

func parseBody[B any](ctx context.Context, c *gin.Context) (body B, err error) {
	err = c.Bind(&body)
	if err != nil {
		bodyErr := fmt.Errorf("error when parsing request: %w", err)

		telemetry.ReportCriticalError(ctx, bodyErr)

		return body, bodyErr
	}

	return body, nil
}
