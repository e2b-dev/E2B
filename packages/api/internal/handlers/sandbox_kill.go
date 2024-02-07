package handlers

import (
	"fmt"
	"net/http"

	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"go.opentelemetry.io/otel/attribute"

	"github.com/gin-gonic/gin"
)

func (a *APIStore) DeleteSandboxesSandboxID(
	c *gin.Context,
	sandboxID string,
) {
	ctx := c.Request.Context()

	teamID := c.Value(constants.TeamContextKey).(models.Team).ID

	telemetry.SetAttributes(ctx,
		attribute.String("instance.id", sandboxID),
		attribute.String("team.id", teamID.String()),
	)

	item, err := a.instanceCache.Get(sandboxID)
	if err != nil {
		errMsg := fmt.Errorf("error when getting sandbox: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error killing sandbox - sandbox '%s' was not found", sandboxID))

		return
	}

	if *item.Value().TeamID != teamID {
		errMsg := fmt.Errorf("sandbox '%s' does not belong to team '%s'", sandboxID, teamID.String())
		telemetry.ReportCriticalError(ctx, errMsg)

		a.sendAPIStoreError(c, http.StatusUnauthorized, fmt.Sprintf("Error killing sandbox - sandbox '%s' does not belong to your team", sandboxID))

		return
	}

	a.instanceCache.Kill(sandboxID)

	c.Status(http.StatusNoContent)
}
