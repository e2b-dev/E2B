package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
)

func (a *APIStore) PostInstances(
	c *gin.Context,
) {
	ctx := c.Request.Context()

	body, err := parseBody[api.PostInstancesJSONRequestBody](ctx, c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))

		return
	}

	envID := body.EnvID
	// Get team id from context, use TeamIDContextKey
	teamID := c.Value(constants.TeamIDContextKey).(string)

	hasAccess, err := a.CheckTeamAccessEnv(envID, teamID, true)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when checking team access: %s", err))

		return
	}

	if !hasAccess {
		a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this environment")

		return
	}

	telemetry.SetAttributes(ctx, attribute.String("instance.team_id", teamID))

	instance, instanceErr := a.nomad.CreateInstance(a.tracer, ctx, envID)
	if instanceErr != nil {
		errMsg := fmt.Errorf("error when creating instance: %w", instanceErr.Err)
		telemetry.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, instanceErr.Code, instanceErr.ClientMsg)

		return
	}

	telemetry.ReportEvent(ctx, "created environment instance")

	a.IdentifyAnalyticsTeam(teamID)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.CreateAnalyticsTeamEvent(teamID, "created_instance", properties.
		Set("environment", envID).
		Set("instance_id", instance.InstanceID))

	startingTime := time.Now()
	if cacheErr := a.cache.Add(instance, &teamID, &startingTime); cacheErr != nil {
		errMsg := fmt.Errorf("error when adding instance to cache: %w", cacheErr)
		telemetry.ReportError(ctx, errMsg)

		delErr := a.DeleteInstance(instance.InstanceID, true)
		if delErr != nil {
			delErrMsg := fmt.Errorf("couldn't delete instance that couldn't be added to cache: %w", delErr.Err)
			telemetry.ReportError(ctx, delErrMsg)
		} else {
			telemetry.ReportEvent(ctx, "deleted instance that couldn't be added to cache")
		}

		a.sendAPIStoreError(c, http.StatusInternalServerError, "Cannot create a environment instance right now")

		return
	}

	telemetry.SetAttributes(ctx,
		attribute.String("instance_id", instance.InstanceID),
	)

	c.JSON(http.StatusCreated, &instance)
}

func (a *APIStore) PostInstancesInstanceIDRefreshes(
	c *gin.Context,
	instanceID string,
) {
	ctx := c.Request.Context()

	telemetry.SetAttributes(ctx,
		attribute.String("instance_id", instanceID),
	)

	// TODO: Require auth for refreshing instance

	err := a.cache.Refresh(instanceID)
	if err != nil {
		errMsg := fmt.Errorf("error when refreshing instance: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error refreshing instance - instance '%s' was not found", instanceID))

		return
	}

	telemetry.ReportEvent(ctx, "refreshed instance")

	c.Status(http.StatusNoContent)
}
