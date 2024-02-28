package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
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

	templateIds := make([]string, 0)
	for _, info := range instanceInfo {
		if *info.TeamID != team.ID {
			continue
		}

		templateIds = append(templateIds, info.Instance.TemplateID)
	}

	templates, err := a.supabase.Client.Env.Query().Where(env.IDIn(templateIds...)).All(ctx)
	if err != nil {
		telemetry.ReportCriticalError(ctx, err)

		return nil
	}

	templatesMap := make(map[string]*models.Env, len(templates))
	for _, template := range templates {
		templatesMap[template.ID] = template
	}

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
			CpuCount:   int(templatesMap[info.Instance.TemplateID].Vcpu),
			MemoryMB:   int(templatesMap[info.Instance.TemplateID].RAMMB),
		}

		if info.Metadata != nil {
			meta := api.SandboxMetadata(info.Metadata)
			instance.Metadata = &meta
		}

		sandboxes = append(sandboxes, instance)
	}

	return sandboxes
}
