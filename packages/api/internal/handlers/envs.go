package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/api/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/hashicorp/go-uuid"
	"github.com/posthog/posthog-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func (a *APIStore) PostEnvs(c *gin.Context) {
	ctx := c.Request.Context()
	span := trace.SpanFromContext(ctx)

	// Prepare info for new env
	userID, teamID, err := a.GetUserAndTeam(c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	SetAttributes(ctx, attribute.String("env.user_id", userID))
	SetAttributes(ctx, attribute.String("env.team_id", teamID))

	envID := utils.GenerateID()
	SetAttributes(ctx, attribute.String("env.id", envID))

	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	dockerfile, buildID, fileContent, err := a.getBuildData(c, ctx, userID, teamID, envID, properties)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when getting build data: %s", err))

		err = fmt.Errorf("error when getting build data: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	a.buildCache.Create(teamID, envID, buildID)

	ReportEvent(ctx, "started creating new environment")

	go func() {
		buildContext, childSpan := a.tracer.Start(
			trace.ContextWithSpanContext(a.Ctx, span.SpanContext()),
			"background-build-env",
		)

		a.buildEnv(buildContext, userID, teamID, envID, buildID, dockerfile, fileContent, properties)

		childSpan.End()
	}()

	result := &api.Environment{
		EnvID:   envID,
		BuildID: buildID,
		Public:  false,
	}

	c.JSON(http.StatusOK, result)
}

func (a *APIStore) PostEnvsEnvID(c *gin.Context, envID api.EnvID) {
	ctx := c.Request.Context()
	span := trace.SpanFromContext(ctx)

	// Prepare info for rebuilding env
	userID, teamID, err := a.GetUserAndTeam(c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	SetAttributes(ctx, attribute.String("env.user_id", userID))
	SetAttributes(ctx, attribute.String("env.team_id", teamID))
	SetAttributes(ctx, attribute.String("env.id", envID))

	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	dockerfile, buildID, fileContent, err := a.getBuildData(c, ctx, userID, teamID, envID, properties)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when getting build data: %s", err))

		err = fmt.Errorf("error when getting build data: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	hasAccess, accessErr := a.supabase.HasEnvAccess(envID, teamID, false)
	if accessErr != nil {
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("The environment '%s' does not exist", envID))

		errMsg := fmt.Errorf("error env not found: %w", accessErr)
		ReportError(ctx, errMsg)

		return
	}
	if !hasAccess {
		a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this environment")

		errMsg := fmt.Errorf("user doesn't have access to env '%s'", envID)
		ReportError(ctx, errMsg)

		return
	}

	err = a.buildCache.CreateIfNotExists(teamID, envID, buildID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusConflict, fmt.Sprintf("There's already running build for %s", envID))

		err = fmt.Errorf("build is already running build for %s", envID)
		ReportCriticalError(ctx, err)

		return
	}

	a.buildCache.Create(teamID, envID, buildID)
	ReportEvent(ctx, "started updating environment")

	go func() {
		buildContext, childSpan := a.tracer.Start(
			trace.ContextWithSpanContext(a.Ctx, span.SpanContext()),
			"background-build-env",
		)

		a.buildEnv(buildContext, userID, teamID, envID, buildID, dockerfile, fileContent, properties)

		childSpan.End()
	}()

	result := &api.Environment{
		EnvID:   envID,
		BuildID: buildID,
		Public:  false,
	}

	c.JSON(http.StatusOK, result)
}

// GetEnvs serves to list envs (e.g. in CLI)
func (a *APIStore) GetEnvs(
	c *gin.Context,
) {
	ctx := c.Request.Context()

	userID := c.Value(constants.UserIDContextKey).(string)

	teamID, err := a.supabase.GetDefaultTeamFromUserID(userID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	SetAttributes(ctx, attribute.String("env.user_id", userID), attribute.String("env.team_id", teamID))

	envs, err := a.supabase.GetEnvs(teamID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting envs: %s", err))

		err = fmt.Errorf("error when getting envs: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	ReportEvent(ctx, "listed environments")

	a.IdentifyAnalyticsTeam(teamID)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.CreateAnalyticsUserEvent(userID, teamID, "listed environments", properties)

	c.JSON(http.StatusOK, envs)
}

// GetEnvsEnvIDBuildsBuildID serves to get an env build status (e.g. to CLI)
func (a *APIStore) GetEnvsEnvIDBuildsBuildID(c *gin.Context, envID api.EnvID, buildID api.BuildID, params api.GetEnvsEnvIDBuildsBuildIDParams) {
	ctx := c.Request.Context()

	userID := c.Value(constants.UserIDContextKey).(string)
	teamID, err := a.supabase.GetDefaultTeamFromUserID(userID)

	SetAttributes(ctx, attribute.String("env.user_id", userID), attribute.String("env.team_id", teamID))

	if err != nil {
		errMsg := fmt.Errorf("error when getting default team: %w", err)
		a.sendAPIStoreError(c, http.StatusInternalServerError, errMsg.Error())

		ReportCriticalError(ctx, errMsg)

		return
	}

	dockerBuild, err := a.buildCache.Get(envID, buildID)
	if err != nil {
		msg := fmt.Errorf("didn't find cache for env %s and build %s", envID, buildID)
		a.sendAPIStoreError(c, http.StatusNotFound, msg.Error())

		ReportError(ctx, msg)

		return
	}

	if teamID != dockerBuild.TeamID {
		msg := fmt.Errorf("user doesn't have access to env '%s'", envID)
		a.sendAPIStoreError(c, http.StatusForbidden, msg.Error())

		ReportError(ctx, msg)

		return
	}

	result := api.EnvironmentBuild{
		Logs:    dockerBuild.Logs[*params.LogsOffset:],
		EnvID:   envID,
		BuildID: buildID,
		Status:  &dockerBuild.Status,
	}

	ReportEvent(ctx, "got environment build")

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
		ReportError(ctx, err)

		return
	}

	ReportEvent(ctx, "got docker build log")

	c.JSON(http.StatusCreated, nil)
}

func (a *APIStore) buildEnv(ctx context.Context, userID, teamID, envID, buildID, dockerfile string, content io.Reader, posthogProperties posthog.Properties) {
	childCtx, childSpan := a.tracer.Start(ctx, "build-env",
		trace.WithAttributes(
			attribute.String("env_id", envID),
		),
	)
	defer childSpan.End()

	var err error

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
		ReportCriticalError(childCtx, err)

		return
	}

	err = a.nomad.BuildEnvJob(a.tracer, childCtx, envID, buildID, a.apiSecret, a.googleServiceAccountBase64)
	if err != nil {
		err = fmt.Errorf("error when starting build: %w", err)
		ReportCriticalError(childCtx, err)

		err = a.buildCache.SetDone(envID, buildID, api.EnvironmentBuildStatusError)
		if err != nil {
			err = fmt.Errorf("error when setting build done in logs: %w", err)
			ReportCriticalError(childCtx, err)
		}

		return
	}

	err = a.supabase.UpsertEnv(teamID, envID, buildID, dockerfile)

	if err != nil {
		err = fmt.Errorf("error when updating env: %w", err)
		ReportCriticalError(childCtx, err)
	}

	err = a.buildCache.SetDone(envID, buildID, api.EnvironmentBuildStatusReady)
	if err != nil {
		err = fmt.Errorf("error when setting build done in logs: %w", err)
		ReportCriticalError(childCtx, err)
	}
}

func (a *APIStore) getBuildData(c *gin.Context, ctx context.Context, userID, teamID, envID string, properties posthog.Properties) (dockerfile, buildID string, fileContent io.ReadCloser, err error) {
	a.IdentifyAnalyticsTeam(teamID)
	a.CreateAnalyticsUserEvent(userID, teamID, "submitted environment build request", properties.
		Set("environment", envID).
		Set("build_id", buildID).
		Set("dockerfile", dockerfile),
	)

	fileContent, fileHandler, err := c.Request.FormFile("buildContext")
	if err != nil {
		err = fmt.Errorf("error when parsing form data: %w", err)
		return dockerfile, buildID, fileContent, err
	}

	defer func() {
		closeErr := fileContent.Close()
		if closeErr != nil {
			errMsg := fmt.Errorf("error when closing file: %w", closeErr)

			ReportError(ctx, errMsg)
		}
	}()

	// Check if file is a tar.gz file
	if !strings.HasSuffix(fileHandler.Filename, ".tar.gz.e2b") {
		a.sendAPIStoreError(c, http.StatusBadRequest, "Build context must be a tar.gz.e2b file")

		err = fmt.Errorf("build context doesn't have correct extension, the file is %s", fileHandler.Filename)
		ReportCriticalError(ctx, err)

		return
	}

	dockerfile = c.PostForm("dockerfile")

	buildID, err = uuid.GenerateUUID()
	if err != nil {
		err = fmt.Errorf("error when generating build id: %w", err)
		ReportCriticalError(ctx, err)

		return dockerfile, buildID, fileContent, err
	}

	return dockerfile, buildID, fileContent, err
}
