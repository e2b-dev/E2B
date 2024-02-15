package utils

import (
	"fmt"

	"github.com/gin-gonic/gin"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func ErrorHandler(c *gin.Context, message string, statusCode int) {
	var errMsg error

	ctx := c.Request.Context()
	body := make([]byte, c.Request.ContentLength)

	_, err := c.Request.Body.Read(body)
	if err == nil {
		errMsg = fmt.Errorf("OpenAPI validation error: %s, body: %s", message, body)
		c.Error(errMsg)
	} else {
		errMsg = fmt.Errorf("OpenAPI validation error: %s, body read error: %w", message, err)
	}

	telemetry.ReportError(ctx, errMsg)

	c.AbortWithStatusJSON(statusCode, gin.H{"error": fmt.Errorf("validation error: %s", message).Error()})
}
