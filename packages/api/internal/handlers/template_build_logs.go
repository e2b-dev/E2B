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

// GetTemplatesTemplateIDBuildsBuildID serves to get an template build status (e.g. to CLI)
func (a *APIStore) GetTemplatesTemplateIDBuildsBuildID(c *gin.Context, templateID api.TemplateID, buildID api.BuildID, params api.GetTemplatesTemplateIDBuildsBuildIDParams) {
	result := a.GetTemplatesTemplateIDBuildsBuildIDWithoutResponse(c, templateID, buildID, params)
	if result != nil {
		c.JSON(http.StatusOK, &result)
	}
}

func (a *APIStore) GetTemplatesTemplateIDBuildsBuildIDWithoutResponse(c *gin.Context, templateID api.TemplateID, buildID api.BuildID, params api.GetTemplatesTemplateIDBuildsBuildIDParams) *api.TemplateBuild {
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

		return nil
	}

	buildUUID, err := uuid.Parse(buildID)
	if err != nil {
		errMsg := fmt.Errorf("error when parsing build id: %w", err)

		a.sendAPIStoreError(c, http.StatusBadRequest, "Invalid build id")

		telemetry.ReportError(ctx, errMsg)

		return nil
	}

	dockerBuild, err := a.buildCache.Get(templateID, buildUUID)
	if err != nil {
		msg := fmt.Errorf("error finding cache for env %s and build %s", templateID, buildID)

		a.sendAPIStoreError(c, http.StatusNotFound, "Build not found")

		telemetry.ReportError(ctx, msg)

		return nil
	}

	if team.ID != dockerBuild.GetTeamID() {
		msg := fmt.Errorf("user doesn't have access to env '%s'", templateID)

		a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this sandbox template")

		telemetry.ReportError(ctx, msg)

		return nil
	}

	status := dockerBuild.GetStatus()
	logs := dockerBuild.GetLogs()

	result := api.TemplateBuild{
		Logs:       logs[*params.LogsOffset:],
		TemplateID: templateID,
		BuildID:    buildID,
		Status:     &status,
	}

	telemetry.ReportEvent(ctx, "got environment build")

	a.posthog.IdentifyAnalyticsTeam(team.ID.String(), team.Name)
	properties := a.posthog.GetPackageToPosthogProperties(&c.Request.Header)
	a.posthog.CreateAnalyticsUserEvent(userID.String(), team.ID.String(), "got environment detail", properties.Set("environment", templateID))

	return &result
}

// PostTemplatesTemplateIDBuildsBuildIDLogs serves to add logs from the Build Driver
func (a *APIStore) PostTemplatesTemplateIDBuildsBuildIDLogs(c *gin.Context, envID api.EnvID, buildID string) {
	ctx := c.Request.Context()

	body, err := parseBody[api.PostTemplatesTemplateIDBuildsBuildIDLogsJSONRequestBody](ctx, c)
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

		errMsg := fmt.Errorf("error when saving docker build logs: %w", err)
		telemetry.ReportError(ctx, errMsg)

		return
	}

	telemetry.ReportEvent(ctx, "added docker build log")

	c.JSON(http.StatusCreated, nil)
}
