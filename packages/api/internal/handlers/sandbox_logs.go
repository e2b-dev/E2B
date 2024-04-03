package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/grafana/loki/pkg/logproto"
	"go.opentelemetry.io/otel/attribute"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"

	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	defaultLogsLimit  int   = 100
	defaultLogsOffset int64 = 0
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

	limit := defaultLogsLimit
	if params.Limit != nil {
		limit = int(*params.Limit)
	}

	offset := defaultLogsOffset
	if params.Offset != nil {
		offset = int64(*params.Offset)
	}

	// TODO: Sanitize id
	// https://grafana.com/blog/2021/01/05/how-to-escape-special-characters-with-lokis-logql/
	id := strings.ReplaceAll(sandboxID, "`", "\\`")
	query := fmt.Sprintf("{source=\"logs-collector\", service=\"envd\"} | json logger=\"logger\", envID=\"envID\", sandboxID=\"instanceID\", teamID=\"teamID\" | teamID = `%s` | sandboxID = `%s`", teamID.String(), id)

	// TODO: Can LogQL handle pagination naturally?
	// TODO: Should we return the final offset with each response?
	res, err := a.lokiClient.Query(query, limit, time.Unix(offset, 0), logproto.FORWARD, false)
	if err != nil {
		errMsg := fmt.Errorf("error when returning logs for sandbox: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error returning logs for sandbox '%s", sandboxID))

		return
	}

	// TODO: Return logs in a good format
	c.JSON(http.StatusOK, res.Data)
}
