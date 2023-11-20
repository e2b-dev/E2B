package handlers

import (
	"cloud.google.com/go/artifactregistry/apiv1beta2/artifactregistrypb"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
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

	// TODO: Non failing
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

	err = a.nomad.DeleteEnv(a.tracer, ctx, envID)
	if err != nil {
		errMsg := fmt.Errorf("error when deleting env: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return
	}

	// TODO: Remove docker context
	err = a.cloudStorage.delete(ctx, envID)
	if err != nil {
		errMsg := fmt.Errorf("error when deleting env: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return
	}
	// TODO: Remove docker image
	op, err := a.artifactRegistry.DeletePackage(ctx, &artifactregistrypb.DeletePackageRequest{Name: "us-central1-docker.pkg.dev/e2b-prod/custom-environments/" + envID})
	if err != nil {
		errMsg := fmt.Errorf("error when deleting env: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return
	}
	err = op.Wait(ctx)
	if err != nil {
		errMsg := fmt.Errorf("error when deleting env: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return
	}

	// TODO: Remove from DB (cascade?)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.IdentifyAnalyticsTeam(team.ID.String(), team.Name)
	a.CreateAnalyticsUserEvent(userID.String(), team.ID.String(), "deleted environment", properties.Set("environment", envID))

	c.JSON(http.StatusOK, nil)
}
