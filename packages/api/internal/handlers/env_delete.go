package handlers

import (
	"fmt"
	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"net/http"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/gin-gonic/gin"
)

// DeleteEnvsEnvID serves to delete an env (e.g. in CLI)
func (a *APIStore) DeleteEnvsEnvID(c *gin.Context, aliasOrEnvID api.EnvID) {
	ctx := c.Request.Context()
	//span := trace.SpanFromContext(ctx)

	cleanedAliasOrEnvID, err := utils.CleanEnvID(aliasOrEnvID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Invalid env ID: %s", aliasOrEnvID))

		err = fmt.Errorf("invalid env ID: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	// Prepare info for rebuilding env
	userID, team, _, err := a.GetUserAndTeam(c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	envID, hasAccess, accessErr := a.CheckTeamAccessEnv(ctx, cleanedAliasOrEnvID, team.ID, false)
	if accessErr != nil {
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("The sandbox template '%s' does not exist", cleanedAliasOrEnvID))

		errMsg := fmt.Errorf("error env not found: %w", accessErr)
		telemetry.ReportError(ctx, errMsg)

		return
	}

	if !hasAccess {
		a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this sandbox template")

		errMsg := fmt.Errorf("user doesn't have access to env '%s'", envID)
		telemetry.ReportError(ctx, errMsg)

		return
	}

	// TODO: Check no running instances?
	// TODO: Add logic

	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.IdentifyAnalyticsTeam(team.ID.String(), team.Name)
	a.CreateAnalyticsUserEvent(userID.String(), team.ID.String(), "deleted environment", properties.Set("environment", envID))

	c.JSON(http.StatusOK, nil)
}
