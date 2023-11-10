package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hashicorp/go-uuid"
	"github.com/posthog/posthog-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/api/internal/nomad"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func (a *APIStore) PostEnvs(c *gin.Context) {
	ctx := c.Request.Context()
	span := trace.SpanFromContext(ctx)

	// Prepare info for new env
	userID, teamID, tier, err := a.GetUserAndTeam(c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, "Failed to get the default team")

		err = fmt.Errorf("error when getting default team: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	envID := utils.GenerateID()

	telemetry.SetAttributes(ctx,
		attribute.String("env.user_id", userID),
		attribute.String("env.team_id", teamID),
		attribute.String("env.id", envID),
		attribute.String("tier", tier.ID),
	)

	buildID, err := uuid.GenerateUUID()
	if err != nil {
		err = fmt.Errorf("error when generating build id: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		a.sendAPIStoreError(c, http.StatusInternalServerError, "Failed to generate build id")

		return
	}

	fileContent, fileHandler, err := c.Request.FormFile("buildContext")
	if err != nil {
		err = fmt.Errorf("error when parsing form data: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		a.sendAPIStoreError(c, http.StatusBadRequest, "Failed to parse form data")

		return
	}

	defer func() {
		closeErr := fileContent.Close()
		if closeErr != nil {
			errMsg := fmt.Errorf("error when closing file: %w", closeErr)

			telemetry.ReportError(ctx, errMsg)
		}
	}()

	// Check if file is a tar.gz file
	if !strings.HasSuffix(fileHandler.Filename, ".tar.gz.e2b") {
		err = fmt.Errorf("build context doesn't have correct extension, the file is %s", fileHandler.Filename)
		telemetry.ReportCriticalError(ctx, err)

		a.sendAPIStoreError(c, http.StatusBadRequest, "Build context must be a tar.gz.e2b file")

		return
	}

	dockerfile := c.PostForm("dockerfile")
	alias := utils.CleanEnvID(c.PostForm("alias"))

	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.IdentifyAnalyticsTeam(teamID)
	a.CreateAnalyticsUserEvent(userID, teamID, "submitted environment build request", properties.
		Set("environment", envID).
		Set("build_id", buildID).
		Set("dockerfile", dockerfile).
		Set("alias", alias),
	)

	telemetry.SetAttributes(ctx,
		attribute.String("build.id", buildID),
		attribute.String("build.alias", alias),
		attribute.String("build.dockerfile", dockerfile),
	)

	err = a.buildCache.Create(teamID, envID, buildID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusConflict, fmt.Sprintf("There's already running build for %s", envID))

		err = fmt.Errorf("build is already running build for %s", envID)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	telemetry.ReportEvent(ctx, "started creating new environment")

	if alias != "" {
		err = a.supabase.EnsureEnvAlias(ctx, alias, envID)
		if err != nil {
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when inserting alias: %s", err))

			err = fmt.Errorf("error when inserting alias: %w", err)
			telemetry.ReportCriticalError(ctx, err)

			a.buildCache.Delete(envID, buildID)

			return
		} else {
			telemetry.ReportEvent(ctx, "inserted alias", attribute.String("alias", alias))
		}
	}

	go func() {
		buildContext, childSpan := a.tracer.Start(
			trace.ContextWithSpanContext(context.Background(), span.SpanContext()),
			"background-build-env",
		)

		var status api.EnvironmentBuildStatus

		buildErr := a.buildEnv(buildContext, userID, teamID, envID, buildID, dockerfile, fileContent, properties, nomad.BuildConfig{
			VCpuCount:  tier.Vcpu,
			MemoryMB:   tier.RAMMB,
			DiskSizeMB: tier.DiskMB,
		})

		if buildErr != nil {
			status = api.EnvironmentBuildStatusError

			errMsg := fmt.Errorf("error when building env: %w", buildErr)

			telemetry.ReportCriticalError(buildContext, errMsg)
		} else {
			status = api.EnvironmentBuildStatusReady

			telemetry.ReportEvent(buildContext, "created new environment", attribute.String("env_id", envID))
		}

		if status == api.EnvironmentBuildStatusError && alias != "" {
			errMsg := a.supabase.DeleteEnvAlias(buildContext, alias)
			if errMsg != nil {
				err = fmt.Errorf("error when deleting alias: %w", errMsg)
				telemetry.ReportError(buildContext, err)
			} else {
				telemetry.ReportEvent(buildContext, "deleted alias", attribute.String("alias", alias))
			}
		} else if status == api.EnvironmentBuildStatusReady && alias != "" {
			errMsg := a.supabase.UpdateEnvAlias(buildContext, alias, envID)
			if errMsg != nil {
				err = fmt.Errorf("error when updating alias: %w", errMsg)
				telemetry.ReportError(buildContext, err)
			} else {
				telemetry.ReportEvent(buildContext, "updated alias", attribute.String("alias", alias))
			}
		}

		cacheErr := a.buildCache.SetDone(envID, buildID, status)
		if cacheErr != nil {
			err = fmt.Errorf("error when setting build done in logs: %w", cacheErr)
			telemetry.ReportCriticalError(buildContext, cacheErr)
		}

		childSpan.End()
	}()

	aliases := []string{}

	if alias != "" {
		aliases = append(aliases, alias)
	}

	result := &api.Environment{
		EnvID:   envID,
		BuildID: buildID,
		Public:  false,
		Aliases: &aliases,
	}

	c.JSON(http.StatusOK, result)
}

func (a *APIStore) PostEnvsEnvID(c *gin.Context, aliasOrEnvID api.EnvID) {
	ctx := c.Request.Context()
	span := trace.SpanFromContext(ctx)

	cleanedAliasOrEnvID := utils.CleanEnvID(aliasOrEnvID)

	// Prepare info for rebuilding env
	userID, teamID, tier, err := a.GetUserAndTeam(c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	telemetry.SetAttributes(ctx,
		attribute.String("env.user_id", userID),
		attribute.String("env.team_id", teamID),
		attribute.String("tier", tier.ID),
	)

	buildID, err := uuid.GenerateUUID()
	if err != nil {
		err = fmt.Errorf("error when generating build id: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		a.sendAPIStoreError(c, http.StatusInternalServerError, "Failed to generate build id")

		return
	}

	fileContent, fileHandler, err := c.Request.FormFile("buildContext")
	if err != nil {
		err = fmt.Errorf("error when parsing form data: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		a.sendAPIStoreError(c, http.StatusBadRequest, "Failed to parse form data")

		return
	}

	defer func() {
		closeErr := fileContent.Close()
		if closeErr != nil {
			errMsg := fmt.Errorf("error when closing file: %w", closeErr)

			telemetry.ReportError(ctx, errMsg)
		}
	}()

	// Check if file is a tar.gz file
	if !strings.HasSuffix(fileHandler.Filename, ".tar.gz.e2b") {
		err = fmt.Errorf("build context doesn't have correct extension, the file is %s", fileHandler.Filename)
		telemetry.ReportCriticalError(ctx, err)

		a.sendAPIStoreError(c, http.StatusBadRequest, "Build context must be a tar.gz.e2b file")

		return
	}

	dockerfile := c.PostForm("dockerfile")
	alias := utils.CleanEnvID(c.PostForm("alias"))

	telemetry.SetAttributes(ctx,
		attribute.String("build.id", buildID),
		attribute.String("build.alias", alias),
	)

	envID, hasAccess, accessErr := a.CheckTeamAccessEnv(ctx, cleanedAliasOrEnvID, teamID, false)
	if accessErr != nil {
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("The sandbox template '%s' does not exist", cleanedAliasOrEnvID))

		errMsg := fmt.Errorf("error env not found: %w", accessErr)
		telemetry.ReportError(ctx, errMsg)

		return
	}

	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.IdentifyAnalyticsTeam(teamID)
	a.CreateAnalyticsUserEvent(userID, teamID, "submitted environment build request", properties.
		Set("environment", envID).
		Set("build_id", buildID).
		Set("alias", alias).
		Set("dockerfile", dockerfile),
	)

	if !hasAccess {
		a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this sandbox template")

		errMsg := fmt.Errorf("user doesn't have access to env '%s'", envID)
		telemetry.ReportError(ctx, errMsg)

		return
	}

	telemetry.SetAttributes(ctx, attribute.String("build.id", buildID))

	err = a.buildCache.Create(teamID, envID, buildID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusConflict, fmt.Sprintf("There's already running build for %s", envID))

		err = fmt.Errorf("build is already running build for %s", envID)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	telemetry.ReportEvent(ctx, "started updating environment")

	if alias != "" {
		err = a.supabase.EnsureEnvAlias(ctx, alias, envID)
		if err != nil {
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when inserting alias: %s", err))

			err = fmt.Errorf("error when inserting alias: %w", err)
			telemetry.ReportCriticalError(ctx, err)

			a.buildCache.Delete(envID, buildID)

			return
		} else {
			telemetry.ReportEvent(ctx, "inserted alias", attribute.String("alias", alias))
		}
	}

	go func() {
		buildContext, childSpan := a.tracer.Start(
			trace.ContextWithSpanContext(context.Background(), span.SpanContext()),
			"background-build-env",
		)

		var status api.EnvironmentBuildStatus

		buildErr := a.buildEnv(buildContext, userID, teamID, envID, buildID, dockerfile, fileContent, properties, nomad.BuildConfig{
			VCpuCount:  tier.Vcpu,
			MemoryMB:   tier.RAMMB,
			DiskSizeMB: tier.DiskMB,
		})

		if buildErr != nil {
			status = api.EnvironmentBuildStatusError

			errMsg := fmt.Errorf("error when building env: %w", buildErr)

			telemetry.ReportCriticalError(buildContext, errMsg)
		} else {
			status = api.EnvironmentBuildStatusReady

			telemetry.ReportEvent(buildContext, "created new environment", attribute.String("env_id", envID))
		}

		if status == api.EnvironmentBuildStatusError && alias != "" {
			errMsg := a.supabase.DeleteNilEnvAlias(buildContext, alias)
			if errMsg != nil {
				err = fmt.Errorf("error when deleting alias: %w", errMsg)
				telemetry.ReportError(buildContext, err)
			} else {
				telemetry.ReportEvent(buildContext, "deleted alias", attribute.String("alias", alias))
			}
		} else if status == api.EnvironmentBuildStatusReady && alias != "" {
			errMsg := a.supabase.UpdateEnvAlias(buildContext, alias, envID)
			if errMsg != nil {
				err = fmt.Errorf("error when updating alias: %w", errMsg)
				telemetry.ReportError(buildContext, err)
			} else {
				telemetry.ReportEvent(buildContext, "updated alias", attribute.String("alias", alias))
			}
		}

		cacheErr := a.buildCache.SetDone(envID, buildID, status)
		if cacheErr != nil {
			errMsg := fmt.Errorf("error when setting build done in logs: %w", cacheErr)
			telemetry.ReportCriticalError(buildContext, errMsg)
		}

		childSpan.End()
	}()

	aliases := []string{}

	if alias != "" {
		aliases = append(aliases, alias)
	}

	result := &api.Environment{
		EnvID:   envID,
		BuildID: buildID,
		Public:  false,
		Aliases: &aliases,
	}

	c.JSON(http.StatusOK, result)
}

// GetEnvs serves to list envs (e.g. in CLI)
func (a *APIStore) GetEnvs(
	c *gin.Context,
) {
	ctx := c.Request.Context()

	userID := c.Value(constants.UserIDContextKey).(string)

	teamID, err := a.supabase.GetDefaultTeamFromUserID(ctx, userID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	telemetry.SetAttributes(ctx,
		attribute.String("env.user_id", userID),
		attribute.String("env.team_id", teamID),
	)

	envs, err := a.supabase.GetEnvs(ctx, teamID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, "Error when getting sandbox templates")

		err = fmt.Errorf("error when getting envs: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	telemetry.ReportEvent(ctx, "listed environments")

	a.IdentifyAnalyticsTeam(teamID)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.CreateAnalyticsUserEvent(userID, teamID, "listed environments", properties)

	c.JSON(http.StatusOK, envs)
}

// GetEnvsEnvIDBuildsBuildID serves to get an env build status (e.g. to CLI)
func (a *APIStore) GetEnvsEnvIDBuildsBuildID(c *gin.Context, envID api.EnvID, buildID api.BuildID, params api.GetEnvsEnvIDBuildsBuildIDParams) {
	ctx := c.Request.Context()

	userID := c.Value(constants.UserIDContextKey).(string)
	teamID, err := a.supabase.GetDefaultTeamFromUserID(ctx, userID)

	telemetry.SetAttributes(ctx,
		attribute.String("env.user_id", userID),
		attribute.String("env.team_id", teamID),
	)

	if err != nil {
		errMsg := fmt.Errorf("error when getting default team: %w", err)

		a.sendAPIStoreError(c, http.StatusInternalServerError, "Failed to get the default team")

		telemetry.ReportCriticalError(ctx, errMsg)

		return
	}

	dockerBuild, err := a.buildCache.Get(envID, buildID)
	if err != nil {
		msg := fmt.Errorf("error finding cache for env %s and build %s", envID, buildID)

		a.sendAPIStoreError(c, http.StatusNotFound, "Build not found")

		telemetry.ReportError(ctx, msg)

		return
	}

	if teamID != dockerBuild.TeamID {
		msg := fmt.Errorf("user doesn't have access to env '%s'", envID)

		a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this sandbox template")

		telemetry.ReportError(ctx, msg)

		return
	}

	result := api.EnvironmentBuild{
		Logs:    dockerBuild.Logs[*params.LogsOffset:],
		EnvID:   envID,
		BuildID: buildID,
		Status:  &dockerBuild.Status,
	}

	telemetry.ReportEvent(ctx, "got environment build")

	a.IdentifyAnalyticsTeam(teamID)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.CreateAnalyticsUserEvent(userID, teamID, "got environment detail", properties.Set("environment", envID))

	c.JSON(http.StatusOK, result)
}

// PostEnvsEnvIDBuildsBuildIDLogs serves to add logs from the Build Driver
func (a *APIStore) PostEnvsEnvIDBuildsBuildIDLogs(c *gin.Context, envID api.EnvID, buildID string) {
	ctx := c.Request.Context()

	body, err := parseBody[api.PostEnvsEnvIDBuildsBuildIDLogsJSONRequestBody](ctx, c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing body: %s", err))

		return
	}

	if body.ApiSecret != a.apiSecret {
		a.sendAPIStoreError(c, http.StatusForbidden, "Invalid api secret")

		return
	}

	err = a.buildCache.Append(envID, buildID, body.Logs)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when saving docker build logs: %s", err))

		err = fmt.Errorf("error when saving docker build logs: %w", err)
		telemetry.ReportError(ctx, err)

		return
	}

	telemetry.ReportEvent(ctx, "got docker build log")

	c.JSON(http.StatusCreated, nil)
}

func (a *APIStore) buildEnv(
	ctx context.Context,
	userID,
	teamID,
	envID,
	buildID,
	dockerfile string,
	content io.Reader,
	posthogProperties posthog.Properties,
	vmConfig nomad.BuildConfig,
) (err error) {
	childCtx, childSpan := a.tracer.Start(ctx, "build-env",
		trace.WithAttributes(
			attribute.String("env_id", envID),
			attribute.String("build_id", buildID),
		),
	)
	defer childSpan.End()

	startTime := time.Now()

	defer func() {
		a.CreateAnalyticsUserEvent(userID, teamID, "built environment", posthogProperties.
			Set("environment", envID).
			Set("build_id", buildID).
			Set("duration", time.Since(startTime).String()).
			Set("success", err != nil),
		)
	}()

	_, err = a.cloudStorage.streamFileUpload(strings.Join([]string{"v1", envID, buildID, "context.tar.gz"}, "/"), content)
	if err != nil {
		err = fmt.Errorf("error when uploading file to cloud storage: %w", err)
		telemetry.ReportCriticalError(childCtx, err)

		return err
	}

	err = a.nomad.BuildEnvJob(a.tracer, childCtx, envID, buildID, a.apiSecret, a.googleServiceAccountBase64, vmConfig)
	if err != nil {
		err = fmt.Errorf("error when building env: %w", err)
		telemetry.ReportCriticalError(childCtx, err)

		return err
	}

	err = a.supabase.UpsertEnv(ctx, teamID, envID, buildID, dockerfile)

	if err != nil {
		err = fmt.Errorf("error when updating env: %w", err)
		telemetry.ReportCriticalError(childCtx, err)

		return err
	}

	return nil
}
