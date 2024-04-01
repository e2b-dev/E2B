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

	if strings.HasPrefix(c.Request.URL.Path, "/instances") ||
		strings.HasPrefix(c.Request.URL.Path, "/envs") {
		errMsg = fmt.Errorf("OpenAPI validation error, old endpoints: %s", message)
		message = "Endpoints are deprecated, please update your SDK to use the new endpoints."
	} else if strings.HasPrefix(c.Request.URL.Path, "/templates") && strings.HasPrefix(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		errMsg = fmt.Errorf("OpenAPI validation error, old CLI: %s", message)
		message = "Endpoint deprecated please update your CLI to the latest version"
	} else {
		data, err := c.GetRawData()
		if err == nil {
			errMsg = fmt.Errorf("OpenAPI validation error: %s, data: %s", message, data)
		} else {
			errMsg = fmt.Errorf("OpenAPI validation error: %s, body read error: %w", message, err)
		}
	}

	telemetry.ReportError(ctx, errMsg)

	c.Error(errMsg)

	if strings.HasPrefix(message, "error in openapi3filter.SecurityRequirementsError: security requirements failed: ") {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "message": strings.TrimPrefix(message, "error in openapi3filter.SecurityRequirementsError: security requirements failed: ")})

		return
	}

	c.AbortWithStatusJSON(statusCode, gin.H{"code": statusCode, "message": fmt.Errorf("validation error: %s", message).Error()})
}
