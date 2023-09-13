package handlers

import (
	"fmt"
	"github.com/e2b-dev/api/packages/api/internal/api"
	"github.com/e2b-dev/api/packages/api/internal/constants"
	"net/http"
	"time"

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

	ReportEvent(ctx, "validated API key")
	SetAttributes(ctx, attribute.String("instance.team_id", teamID))

	instance, instanceErr := a.nomad.CreateInstance(a.tracer, ctx, envID)
	if instanceErr != nil {
		errMsg := fmt.Errorf("error when creating instance: %w", instanceErr)
		ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, instanceErr.Code, instanceErr.ClientMsg)

		return
	}

	ReportEvent(ctx, "created environment instance")

	a.IdentifyAnalyticsTeam(teamID)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.CreateAnalyticsTeamEvent(teamID, "created_session", properties.
		Set("environment", envID).
		Set("session_id", instance.InstanceID))

	startingTime := time.Now()
	if cacheErr := a.cache.Add(instance, &teamID, &startingTime); cacheErr != nil {
		errMsg := fmt.Errorf("error when adding instance to cache: %w", cacheErr)
		ReportError(ctx, errMsg)

		delErr := a.DeleteInstance(instance.InstanceID, true)
		if delErr != nil {
			delErrMsg := fmt.Errorf("couldn't delete instance that couldn't be added to cache: %w", delErr)
			ReportError(ctx, delErrMsg)
		} else {
			ReportEvent(ctx, "deleted instance that couldn't be added to cache")
		}

		a.sendAPIStoreError(c, http.StatusInternalServerError, "Cannot create a environment instance right now")

		return
	}

	SetAttributes(ctx,
		attribute.String("instance_id", instance.InstanceID),
	)

	c.JSON(http.StatusCreated, &instance)
}

func (a *APIStore) PostInstancesInstanceIDRefreshes(
	c *gin.Context,
	instanceID string,
) {
	ctx := c.Request.Context()

	SetAttributes(ctx,
		attribute.String("instance_id", instanceID),
	)

	// TODO: Require auth for refreshing instance

	err := a.cache.Refresh(instanceID)
	if err != nil {
		errMsg := fmt.Errorf("error when refreshing instance: %w", err)
		ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error refreshing instance - instance '%s' was not found", instanceID))

		return
	}

	ReportEvent(ctx, "refreshed instance")

	c.Status(http.StatusNoContent)
}
