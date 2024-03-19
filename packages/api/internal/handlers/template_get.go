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
	ctx := c.Request.Context()

	userID := c.Value(constants.UserIDContextKey).(uuid.UUID)

	team, err := a.db.GetDefaultTeamFromUserID(ctx, userID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	telemetry.SetAttributes(ctx,
		attribute.String("user.id", userID.String()),
		attribute.String("team.id", team.ID.String()),
	)

	envs, err := a.db.GetEnvs(ctx, team.ID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, "Error when getting sandbox templates")

		err = fmt.Errorf("error when getting envs: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	telemetry.ReportEvent(ctx, "listed environments")

	a.posthog.IdentifyAnalyticsTeam(team.ID.String(), team.Name)
	properties := a.posthog.GetPackageToPosthogProperties(&c.Request.Header)
	a.posthog.CreateAnalyticsUserEvent(userID.String(), team.ID.String(), "listed environments", properties)

	templates := make([]*api.Template, 0, len(envs))
	for _, item := range envs {
		templates = append(templates, &api.Template{
			TemplateID: item.TemplateID,
			BuildID:    item.BuildID,
			CpuCount:   int(item.VCPU),
			MemoryMB:   int(item.RAMMB),
			Public:     item.Public,
			Aliases:    item.Aliases,
		})
	}

	c.JSON(http.StatusOK, templates)
}
