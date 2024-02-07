package handlers

import (
	"fmt"
	"net/http"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/gin-gonic/gin"
)

func (a *APIStore) DeleteSandboxesSandboxID(
	c *gin.Context,
	sandboxID string,
) {
	ctx := c.Request.Context()

	// TODO: Check if the sandbox was created by the team that is trying to kill it

	_, err := a.instanceCache.Get(sandboxID)
	if err != nil {
		errMsg := fmt.Errorf("error when getting sandbox: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error killing sandbox - sandbox '%s' was not found", sandboxID))

		return
	}

	deleteErr := a.nomad.DeleteInstance(sandboxID, true)
	if deleteErr != nil {
		errMsg := fmt.Errorf("error when killing sandbox: %s", deleteErr.ClientMsg)
		a.sendAPIStoreError(c, deleteErr.Code, fmt.Sprintf("Error killing sandbox - sandbox '%s' was not found", sandboxID))
		telemetry.ReportCriticalError(ctx, errMsg)

		return
	}

	c.Status(http.StatusNoContent)
}
