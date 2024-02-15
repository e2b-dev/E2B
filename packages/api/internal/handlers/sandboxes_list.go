package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func (a *APIStore) GetSandboxes(c *gin.Context) {
	sandboxes := a.GetSandboxesWithoutResponse(c)
	c.JSON(http.StatusOK, sandboxes)
}

func (a *APIStore) GetSandboxesWithoutResponse(c *gin.Context) []api.RunningSandboxes {
	ctx := c.Request.Context()

	team := c.Value(constants.TeamContextKey).(models.Team)

	telemetry.ReportEvent(ctx, "list running instances")

	instanceInfo := a.instanceCache.GetInstances(&team.ID)

	a.posthog.IdentifyAnalyticsTeam(team.ID.String(), team.Name)
	properties := a.posthog.GetPackageToPosthogProperties(&c.Request.Header)
	a.posthog.CreateAnalyticsTeamEvent(team.ID.String(), "listed running instances", properties)

	sandboxes := make([]api.RunningSandboxes, 0)

	for _, info := range instanceInfo {
		if *info.TeamID != team.ID {
			continue
		}

		instance := api.RunningSandboxes{
			ClientID:   info.Instance.ClientID,
			TemplateID: info.Instance.TemplateID,
			Alias:      info.Instance.Alias,
			SandboxID:  info.Instance.SandboxID,
			StartedAt:  *info.StartTime,
		}

		if info.Metadata != nil {
			meta := api.SandboxMetadata(info.Metadata)
			instance.Metadata = &meta
		}

		sandboxes = append(sandboxes, instance)
	}

	return sandboxes
}
