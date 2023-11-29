package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"cloud.google.com/go/artifactregistry/apiv1/artifactregistrypb"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	// DockerImagesURL is the URL to the docker images in the artifact registry
	DockerImagesURL = "/" + constants.ProjectID + "/locations/" + constants.Location + "/repositories/" + constants.DockerRepositoryName + "/packages/"
)

// DeleteEnvsEnvID serves to delete an env (e.g. in CLI)
func (a *APIStore) DeleteEnvsEnvID(c *gin.Context, aliasOrEnvID api.EnvID) {
	ctx := c.Request.Context()

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
		errMsg := fmt.Errorf("error env not found: %w", accessErr)
		telemetry.ReportError(ctx, errMsg)

		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("the sandbox template '%s' wasn't found", cleanedAliasOrEnvID))

		return
	}

	telemetry.SetAttributes(ctx,
		attribute.String("user.id", userID.String()),
		attribute.String("env.team.id", team.ID.String()),
		attribute.String("env.team.name", team.Name),
		attribute.String("env.id", envID),
	)

	if !hasAccess {
		a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this sandbox template")

		errMsg := fmt.Errorf("user doesn't have access to env '%s'", envID)
		telemetry.ReportError(ctx, errMsg)

		return
	}

	deleteJobErr := a.nomad.DeleteEnv(a.tracer, ctx, envID)
	if deleteJobErr != nil {
		errMsg := fmt.Errorf("error when deleting env files from fc-envs disk: %w", deleteJobErr)
		telemetry.ReportCriticalError(ctx, errMsg)
	} else {
		telemetry.ReportEvent(ctx, "deleted env from fc-envs disk")
	}

	dockerContextDelErr := a.cloudStorage.deleteFolder(ctx, strings.Join([]string{"v1", envID}, "/"))
	if dockerContextDelErr != nil {
		errMsg := fmt.Errorf("error when deleting env docker context from storage bucket: %w", dockerContextDelErr)
		telemetry.ReportCriticalError(ctx, errMsg)
	} else {
		telemetry.ReportEvent(ctx, "deleted env docker context form storage bucket")
	}

	op, artifactRegistryDeleteErr := a.artifactRegistry.DeletePackage(ctx, &artifactregistrypb.DeletePackageRequest{Name: DockerImagesURL + envID})
	if artifactRegistryDeleteErr != nil {
		errMsg := fmt.Errorf("error when deleting env image from registry: %w", artifactRegistryDeleteErr)
		telemetry.ReportCriticalError(ctx, errMsg)
	} else {
		telemetry.ReportEvent(ctx, "started deleting env image from registry")

		err = op.Wait(ctx)
		if err != nil {
			errMsg := fmt.Errorf("error when waiting for env image deleting from registry: %w", err)
			telemetry.ReportCriticalError(ctx, errMsg)
		} else {
			telemetry.ReportEvent(ctx, "deleted env image from registry")
		}
	}

	dbErr := a.supabase.DeleteEnv(ctx, envID)
	if dbErr != nil {
		errMsg := fmt.Errorf("error when deleting env from db: %w", dbErr)
		telemetry.ReportCriticalError(ctx, errMsg)

		a.sendAPIStoreError(c, http.StatusInternalServerError, "Error when deleting env")

		return
	}

	telemetry.ReportEvent(ctx, "deleted env from db")

	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.IdentifyAnalyticsTeam(team.ID.String(), team.Name)
	a.CreateAnalyticsUserEvent(userID.String(), team.ID.String(), "deleted environment", properties.Set("environment", envID))

	c.JSON(http.StatusOK, nil)
}
