package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

// GetEnvsEnvIDBuildsBuildID serves to get an env build status (e.g. to CLI)
func (a *APIStore) GetEnvsEnvIDBuildsBuildID(c *gin.Context, envID api.EnvID, buildID api.BuildID, params api.GetEnvsEnvIDBuildsBuildIDParams) {
	ctx := c.Request.Context()

	userID := c.Value(constants.UserIDContextKey).(uuid.UUID)
	team, err := a.supabase.GetDefaultTeamFromUserID(ctx, userID)

	telemetry.SetAttributes(ctx,
		attribute.String("user.id", userID.String()),
		attribute.String("env.team.id", team.ID.String()),
	)

	if err != nil {
		errMsg := fmt.Errorf("error when getting default team: %w", err)

		a.sendAPIStoreError(c, http.StatusInternalServerError, "Failed to get the default team")

		telemetry.ReportCriticalError(ctx, errMsg)

		return
	}

	buildUUID, err := uuid.Parse(buildID)
	if err != nil {
		errMsg := fmt.Errorf("error when parsing build id: %w", err)

		a.sendAPIStoreError(c, http.StatusBadRequest, "Invalid build id")

		telemetry.ReportError(ctx, errMsg)

		return
	}

	dockerBuild, err := a.buildCache.Get(envID, buildUUID)
	if err != nil {
		msg := fmt.Errorf("error finding cache for env %s and build %s", envID, buildID)

		a.sendAPIStoreError(c, http.StatusNotFound, "Build not found")

		telemetry.ReportError(ctx, msg)

		return
	}

	if team.ID != dockerBuild.TeamID {
		msg := fmt.Errorf("user doesn't have access to env '%s'", envID)

		a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this sandbox template")

		telemetry.ReportError(ctx, msg)

		return
	}

	result := api.EnvironmentBuild{
		Logs:    dockerBuild.Logs[*params.LogsOffset:],
		EnvID:   envID,
		BuildID: buildID,
		Status:  &dockerBuild.Status,
	}

	telemetry.ReportEvent(ctx, "got environment build")

	a.IdentifyAnalyticsTeam(team.ID.String(), team.Name)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.CreateAnalyticsUserEvent(userID.String(), team.ID.String(), "got environment detail", properties.Set("environment", envID))

	c.JSON(http.StatusOK, result)
}

// PostEnvsEnvIDBuildsBuildIDLogs serves to add logs from the Build Driver
func (a *APIStore) PostEnvsEnvIDBuildsBuildIDLogs(c *gin.Context, envID api.EnvID, buildID string) {
	ctx := c.Request.Context()

	body, err := parseBody[api.PostEnvsEnvIDBuildsBuildIDLogsJSONRequestBody](ctx, c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing body: %s", err))

		err = fmt.Errorf("error when parsing body: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	if body.ApiSecret != a.apiSecret {
		a.sendAPIStoreError(c, http.StatusForbidden, "Invalid api secret")

		err = fmt.Errorf("invalid api secret")
		telemetry.ReportError(ctx, err)

		return
	}

	buildUUID, err := uuid.Parse(buildID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, "Invalid build id")

		err = fmt.Errorf("invalid build id: %w", err)
		telemetry.ReportError(ctx, err)

		return
	}

	err = a.buildCache.Append(envID, buildUUID, body.Logs)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when saving docker build logs: %s", err))

		err = fmt.Errorf("error when saving docker build logs: %w", err)
		telemetry.ReportError(ctx, err)

		return
	}

	telemetry.ReportEvent(ctx, "got docker build log")

	c.JSON(http.StatusCreated, nil)
}
