package handlers

import (
	"github.com/gin-gonic/gin"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func (a *APIStore) GetInstances(c *gin.Context) {
	ctx := c.Request.Context()

	team := c.Value(constants.TeamContextKey).(models.Team)

	telemetry.ReportEvent(ctx, "list running instances")

	instanceInfo := a.instanceCache.GetInstances(&team.ID)

	IdentifyAnalyticsTeam(a.posthog, team.ID.String(), team.Name)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	CreateAnalyticsTeamEvent(a.posthog, team.ID.String(), "listed running instances", properties)

	var instances []api.RunningInstance

	for _, info := range instanceInfo {
		if *info.TeamID != team.ID {
			continue
		}

		instance := api.RunningInstance{
			ClientID:   info.Instance.ClientID,
			EnvID:      info.Instance.EnvID,
			Alias:      info.Instance.Alias,
			InstanceID: info.Instance.InstanceID,
			StartedAt:  *info.StartTime,
		}

		if info.Metadata != nil {
			meta := api.InstanceMetadata(info.Metadata)
			instance.Metadata = &meta
		}

		instances = append(instances, instance)
	}

	c.JSON(200, instances)
}
