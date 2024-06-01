package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/gin-gonic/gin"
)

func (a *APIStore) PostSandboxesSandboxIDTimeout(
	c *gin.Context,
	sandboxID string,
) {
	ctx := c.Request.Context()
	sandboxID = utils.ShortID(sandboxID)

	var duration time.Duration

	body, err := utils.ParseBody[api.PostSandboxesSandboxIDTimeoutJSONBody](ctx, c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))

		errMsg := fmt.Errorf("error when parsing request: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return
	}

	if body.Timeout < 0 {
		duration = 0
	} else {
		duration = time.Duration(body.Timeout) * time.Second
	}

	err = a.instanceCache.SetTimeout(sandboxID, duration)
	if err != nil {
		errMsg := fmt.Errorf("error setting sandbox timeout: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error setting sandbox timeout - sandbox '%s' was not found", sandboxID))

		return
	}

	c.Status(http.StatusNoContent)
}
