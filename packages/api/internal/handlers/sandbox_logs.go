package handlers

import (
	"fmt"
	authcache "github.com/e2b-dev/infra/packages/api/internal/cache/auth"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/grafana/loki/pkg/loghttp"
	"github.com/grafana/loki/pkg/logproto"
	"go.opentelemetry.io/otel/attribute"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/auth"
	"github.com/e2b-dev/infra/packages/api/internal/utils"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	oldestLogsLimit = 168 * time.Hour // 7 days
)

func (a *APIStore) GetSandboxesSandboxIDLogs(
	c *gin.Context,
	sandboxID string,
	params api.GetSandboxesSandboxIDLogsParams,
) {
	ctx := c.Request.Context()
	sandboxID = utils.ShortID(sandboxID)

	teamID := c.Value(auth.TeamContextKey).(authcache.AuthTeamInfo).Team.ID

	telemetry.SetAttributes(ctx,
		attribute.String("instance.id", sandboxID),
		attribute.String("team.id", teamID.String()),
	)

	var start time.Time

	end := time.Now()

	if params.Start != nil {
		start = time.UnixMilli(int64(*params.Start))
	} else {
		start = end.Add(-oldestLogsLimit)
	}

	// Sanitize ID
	// https://grafana.com/blog/2021/01/05/how-to-escape-special-characters-with-lokis-logql/
	id := strings.ReplaceAll(sandboxID, "`", "")
	query := fmt.Sprintf("{source=\"logs-collector\", service=\"envd\", teamID=`%s`, sandboxID=`%s`}", teamID.String(), id)

	res, err := a.lokiClient.QueryRange(query, *params.Limit, start, end, logproto.FORWARD, time.Duration(0), time.Duration(0), false)
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
