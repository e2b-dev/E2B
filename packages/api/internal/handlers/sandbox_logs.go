package handlers

import (
	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"

	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
)

func (a *APIStore) GetSandboxesSandboxIDLogs(
	c *gin.Context,
	sandboxID string,
	params api.GetSandboxesSandboxIDLogsParams,
) {
	ctx := c.Request.Context()

	teamID := c.Value(constants.TeamContextKey).(models.Team).ID

	telemetry.SetAttributes(ctx,
		attribute.String("instance.id", sandboxID),
		attribute.String("team.id", teamID.String()),
	)

	res, err := a.lokiClient.QueryRange()
	if err != nil {
	}

	resType := res.Data.Result.Type()

	// TODO: Sanitize offset, id
	// TODO: Filter for teamID too -> can this be part of the query?
	// TODO: Create LogQL query to get logs from the sandbox
	// TODO: Can LogQL handle pagination naturally?

	// TODO: Return logs
}
