package handlers

import (
	"context"
	"fmt"
	"net/http"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func (a *APIStore) PostSandboxes(c *gin.Context) {
	sandbox := a.PostSandboxesWithoutResponse(c)
	if sandbox != nil {
		c.JSON(http.StatusCreated, &sandbox)
	}
}

func (a *APIStore) PostSandboxesWithoutResponse(c *gin.Context) *api.Sandbox {
	ctx := c.Request.Context()
	span := trace.SpanFromContext(ctx)

	c.Set("traceID", span.SpanContext().TraceID().String())

	body, err := parseBody[api.PostInstancesJSONRequestBody](ctx, c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))

		errMsg := fmt.Errorf("error when parsing request: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return nil
	}

	cleanedAliasOrEnvID, err := utils.CleanEnvID(body.EnvID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Invalid environment ID: %s", err))

		errMsg := fmt.Errorf("error when cleaning env ID: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return nil
	}

	// Get team from context, use TeamContextKey
	team := c.Value(constants.TeamContextKey).(models.Team)

	env, hasAccess, checkErr := a.CheckTeamAccessEnv(ctx, cleanedAliasOrEnvID, team.ID, true)
	if checkErr != nil {
		errMsg := fmt.Errorf("error when checking team access: %w", checkErr)
		telemetry.ReportCriticalError(ctx, errMsg)

		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when checking team access: %s", checkErr))

		return nil
	}

	if !hasAccess {
		errMsg := fmt.Errorf("team '%s' doesn't have access to env '%s'", team.ID, env.EnvID)
		telemetry.ReportError(ctx, errMsg)

		a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this environment")

		return nil
	}

	var alias string
	if env.Aliases != nil && len(*env.Aliases) > 0 {
		alias = (*env.Aliases)[0]
	}

	c.Set("envID", env.EnvID)
	c.Set("teamID", team.ID.String())

	telemetry.SetAttributes(ctx,
		attribute.String("env.team.id", team.ID.String()),
		attribute.String("env.id", env.EnvID),
		attribute.String("env.alias", alias),
	)

	// Check if team has reached max instances
	maxInstancesPerTeam := team.Edges.TeamTier.ConcurrentInstances
	if instanceCount := a.instanceCache.CountForTeam(team.ID); int64(instanceCount) >= maxInstancesPerTeam {
		errMsg := fmt.Errorf("team '%s' has reached the maximum number of instances (%d)", team.ID, team.Edges.TeamTier.ConcurrentInstances)
		telemetry.ReportCriticalError(ctx, errMsg)

		a.sendAPIStoreError(c, http.StatusForbidden, fmt.Sprintf(
			"You have reached the maximum number of concurrent E2B sandboxes (%d). If you need more, "+
				"please contact us at 'https://e2b.dev/docs/getting-help'", maxInstancesPerTeam))

		return nil
	}

	var metadata map[string]string
	if body.Metadata != nil {
		metadata = *body.Metadata
	}

	sandbox, instanceErr := a.nomad.CreateSandbox(a.tracer, ctx, env.EnvID, alias, team.ID.String(), metadata)
	if instanceErr != nil {
		errMsg := fmt.Errorf("error when creating instance: %w", instanceErr.Err)
		telemetry.ReportCriticalError(ctx, errMsg)

		a.sendAPIStoreError(c, instanceErr.Code, instanceErr.ClientMsg)

		return nil
	}

	c.Set("instanceID", sandbox.SandboxID)

	telemetry.ReportEvent(ctx, "created environment instance")

	IdentifyAnalyticsTeam(a.posthog, team.ID.String(), team.Name)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	CreateAnalyticsTeamEvent(a.posthog, team.ID.String(), "created_instance",
		properties.
			Set("environment", env.EnvID).
			Set("instance_id", sandbox.SandboxID).
			Set("alias", alias),
	)

	if cacheErr := a.instanceCache.Add(InstanceInfo{
		Instance: sandbox,
		TeamID:   &team.ID,
		Metadata: metadata,
	}); cacheErr != nil {
		errMsg := fmt.Errorf("error when adding instance to cache: %w", cacheErr)
		telemetry.ReportError(ctx, errMsg)

		delErr := a.DeleteInstance(sandbox.SandboxID, true)
		if delErr != nil {
			delErrMsg := fmt.Errorf("couldn't delete instance that couldn't be added to cache: %w", delErr.Err)
			telemetry.ReportError(ctx, delErrMsg)
		} else {
			telemetry.ReportEvent(ctx, "deleted instance that couldn't be added to cache")
		}

		a.sendAPIStoreError(c, http.StatusInternalServerError, "Cannot create a sandbox right now")

		return nil
	}

	go func() {
		updateContext, childSpan := a.tracer.Start(
			trace.ContextWithSpanContext(context.Background(), span.SpanContext()),
			"update-spawn-count-for-env",
		)
		defer childSpan.End()

		err = a.supabase.UpdateEnvLastUsed(updateContext, env.EnvID)
		if err != nil {
			telemetry.ReportCriticalError(updateContext, err)
		} else {
			telemetry.ReportEvent(updateContext, "updated last used for env")
		}
	}()

	telemetry.SetAttributes(ctx,
		attribute.String("instance.id", sandbox.SandboxID),
	)

	return sandbox
}
