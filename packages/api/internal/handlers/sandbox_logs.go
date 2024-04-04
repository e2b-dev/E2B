package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/grafana/loki/pkg/loghttp"
	"github.com/grafana/loki/pkg/logproto"
	"go.opentelemetry.io/otel/attribute"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/api/internal/utils"

	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	defaultLogsLimit int = 1000
	oldestLogsLimit      = 168 * time.Hour // 7 days
)

func defaultStartTime() int64 {
	return time.Now().Add(-oldestLogsLimit).UnixNano()
}

func (a *APIStore) GetSandboxesSandboxIDLogs(
	c *gin.Context,
	sandboxID string,
	params api.GetSandboxesSandboxIDLogsParams,
) {
	ctx := c.Request.Context()
	sandboxID = utils.ShortID(sandboxID)

	teamID := c.Value(constants.TeamContextKey).(models.Team).ID

	telemetry.SetAttributes(ctx,
		attribute.String("instance.id", sandboxID),
		attribute.String("team.id", teamID.String()),
	)

	limit := defaultLogsLimit
	if params.Limit != nil {
		limit = *params.Limit
	}

	since := defaultStartTime()
	if params.Start != nil {
		since = int64(*params.Start)
	}

	// Sanitize ID
	// https://grafana.com/blog/2021/01/05/how-to-escape-special-characters-with-lokis-logql/
	id := strings.ReplaceAll(sandboxID, "`", "")
	query := fmt.Sprintf("{source=\"logs-collector\", service=\"envd\", teamID=`%s`, sandboxID=`%s`}", teamID.String(), id)

	// TODO: Check if the nanoseconds conversion is correct
	res, err := a.lokiClient.QueryRange(query, limit, time.Unix(0, since), time.Now(), logproto.FORWARD, time.Duration(0), time.Duration(0), false)
	if err != nil {
		errMsg := fmt.Errorf("error when returning logs for sandbox: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error returning logs for sandbox '%s", sandboxID))

		return
	}

	switch res.Data.Result.Type() {
	case loghttp.ResultTypeStream:
		value := res.Data.Result.(loghttp.Streams)

		logs := make([]api.SandboxLog, 0)

		for _, stream := range value {
			for _, entry := range stream.Entries {
				logs = append(logs, api.SandboxLog{
					Timestamp: entry.Timestamp,
					Line:      entry.Line,
				})
			}
		}

		c.JSON(http.StatusOK, &api.SandboxLogs{
			Logs: logs,
		})

	default:
		errMsg := fmt.Errorf("unexpected value type %T", res.Data.Result.Type())
		telemetry.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error returning logs for sandbox '%s", sandboxID))

		return
	}
}
