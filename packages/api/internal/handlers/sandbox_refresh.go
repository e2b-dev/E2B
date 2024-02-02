package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/nomad"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/gin-gonic/gin"
)

func (a *APIStore) PostSandboxesSandboxIDRefreshes(
	c *gin.Context,
	sandboxID string,
) {
	ctx := c.Request.Context()

	var duration time.Duration

	body, err := parseBody[api.PostInstancesInstanceIDRefreshesJSONRequestBody](ctx, c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))

		errMsg := fmt.Errorf("error when parsing request: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return
	}

	if body.Duration == nil {
		duration = nomad.InstanceExpiration
	} else {
		duration = time.Duration(*body.Duration) * time.Second
	}

	if duration < nomad.InstanceExpiration {
		duration = nomad.InstanceExpiration
	}

	err = a.instanceCache.KeepAliveFor(sandboxID, duration)
	if err != nil {
		errMsg := fmt.Errorf("error when refreshing instance: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error refreshing sandbox - sandbox '%s' was not found", sandboxID))

		return
	}

	c.Status(http.StatusNoContent)
}
