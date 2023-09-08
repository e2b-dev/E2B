package handlers

import (
	"context"
	"fmt"

	"github.com/gin-gonic/gin"
)

func parseBody[B any](ctx context.Context, c *gin.Context) (body B, err error) {
	err = c.Bind(&body)
	if err != nil {
		bodyErr := fmt.Errorf("error when parsing request: %w", err)
		ReportCriticalError(ctx, bodyErr)

		return body, bodyErr
	}

	ReportEvent(ctx, "parsed request")

	return body, nil
}
