package utils

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func ErrorHandler(c *gin.Context, message string, statusCode int) {
	var errMsg error

	ctx := c.Request.Context()

	// TODO: If old template request -> Update CLI
	data, err := c.GetRawData()
	if err == nil {
		errMsg = fmt.Errorf("OpenAPI validation error: %s, data: %s", message, data)
	} else {
		errMsg = fmt.Errorf("OpenAPI validation error: %s, body read error: %w", message, err)
	}

	telemetry.ReportError(ctx, errMsg)

	c.Error(errMsg)

	if strings.HasPrefix(message, "error in openapi3filter.SecurityRequirementsError: security requirements failed: ") {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "message": strings.TrimPrefix(message, "error in openapi3filter.SecurityRequirementsError: security requirements failed: ")})

		return
	}

	c.AbortWithStatusJSON(statusCode, gin.H{"code": statusCode, "message": fmt.Errorf("validation error: %s", message).Error()})
}
