package handlers

import (
	"fmt"
	"net/http"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"

	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

// GetTemplates serves to list templates (e.g. in CLI)
func (a *APIStore) GetTemplates(c *gin.Context) {
	templates := a.GetTemplatesWithoutResponse(c)

	if templates != nil {
		c.JSON(http.StatusOK, templates)
	}
}
func (a *APIStore) GetTemplatesWithoutResponse(c *gin.Context) []*api.Template {
	ctx := c.Request.Context()

	userID := c.Value(constants.UserIDContextKey).(uuid.UUID)

	team, err := a.supabase.GetDefaultTeamFromUserID(ctx, userID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return nil
	}

	telemetry.SetAttributes(ctx,
		attribute.String("user.id", userID.String()),
		attribute.String("team.id", team.ID.String()),
	)

	envs, err := a.supabase.GetEnvs(ctx, team.ID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, "Error when getting sandbox templates")

		err = fmt.Errorf("error when getting envs: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return nil
	}

	telemetry.ReportEvent(ctx, "listed environments")

	IdentifyAnalyticsTeam(a.posthog, team.ID.String(), team.Name)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	CreateAnalyticsUserEvent(a.posthog, userID.String(), team.ID.String(), "listed environments", properties)

	return envs
}
