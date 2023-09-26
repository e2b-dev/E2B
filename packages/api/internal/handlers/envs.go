package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hashicorp/go-uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/api/packages/api/internal/api"
	"github.com/e2b-dev/api/packages/api/internal/constants"
	"github.com/e2b-dev/api/packages/api/internal/db/models"
	"github.com/e2b-dev/api/packages/api/internal/utils"
)

func (a *APIStore) buildEnv(ctx context.Context, envID string, content io.Reader) {
	childCtx, childSpan := a.tracer.Start(ctx, "build-env",
		trace.WithAttributes(
			attribute.String("env_id", envID),
		),
	)
	defer childSpan.End()

	buildID, err := uuid.GenerateUUID()
	if err != nil {
		err = fmt.Errorf("error when generating build id: %w", err)
		ReportCriticalError(childCtx, err)

		return
	}

	_, err = a.cloudStorage.streamFileUpload(strings.Join([]string{"v1", envID, buildID, "context.tar.gz"}, "/"), content)
	if err != nil {
		err = fmt.Errorf("error when uploading file to cloud storage: %w", err)
		ReportCriticalError(childCtx, err)

		return
	}

	var buildStatus models.EnvStatusEnum

	err = a.nomad.BuildEnvJob(a.tracer, childCtx, envID, buildID)
	if err != nil {
		err = fmt.Errorf("error when starting build: %w", err)
		ReportCriticalError(childCtx, err)

		buildStatus = models.EnvStatusEnumError
	} else {
		buildStatus = models.EnvStatusEnumReady
	}

	_, err = a.supabase.UpdateStatusEnv(envID, buildStatus)
	if err != nil {
		err = fmt.Errorf("error when updating env: %w", err)
		ReportCriticalError(childCtx, err)
	}
}

func (a *APIStore) PostEnvs(c *gin.Context) {
	ctx := c.Request.Context()
	span := trace.SpanFromContext(ctx)

	// Prepare info for new env
	userID := c.Value(constants.UserIDContextKey).(string)

	SetAttributes(ctx, attribute.String("env.user_id", userID))

	team, err := a.supabase.GetDefaultTeamFromUserID(userID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	SetAttributes(ctx, attribute.String("env.team_id", team.ID))

	fileContent, fileHandler, err := c.Request.FormFile("buildContext")
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, "Error when parsing form data")

		err = fmt.Errorf("error when parsing form data: %w", err)
		ReportCriticalError(ctx, err)

		return
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

		err = fmt.Errorf("build context doesn't have corrent extension, the file is %s", fileHandler.Filename)
		ReportCriticalError(ctx, err)

		return
	}

	var env *api.Environment

	envID := c.PostForm("envID")

	if envID == "" {
		envID = utils.GenerateID()
		SetAttributes(ctx, attribute.String("env.id", envID))
		env, err = a.supabase.CreateEnv(envID, team.ID, c.PostForm("dockerfile"))

		if err != nil {
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when creating env: %s", err))

			errMsg := fmt.Errorf("error when creating env: %w", err)
			ReportCriticalError(ctx, errMsg)

			return
		}

		ReportEvent(ctx, "created new environment")
	} else {
		SetAttributes(ctx, attribute.String("env.id", envID))

		hasAccess, err := a.supabase.HasEnvAccess(envID, team.ID, false)
		if err != nil {
			a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("The environment '%s' does not exist", envID))

			errMsg := fmt.Errorf("error env not found: %w", err)
			ReportError(ctx, errMsg)

			return
		}
		if !hasAccess {
			a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this environment")

			errMsg := fmt.Errorf("user doesn't have access to env: %w", err)
			ReportError(ctx, errMsg)

			return
		}
		env, err = a.supabase.UpdateDockerfileEnv(envID, c.PostForm("dockerfile"))

		if err != nil {
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when updating envs: %s", err))

			errMsg := fmt.Errorf("error when updating envs: %w", err)
			ReportCriticalError(ctx, errMsg)

			return
		}

		ReportEvent(ctx, "updated environment")
	}

	go func() {
		buildContext, childSpan := a.tracer.Start(
			trace.ContextWithSpanContext(context.Background(), span.SpanContext()),
			"background-build-env",
		)

		a.buildEnv(buildContext, envID, fileContent)

		childSpan.End()
	}()

	a.IdentifyAnalyticsTeam(team.ID)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.CreateAnalyticsUserEvent(userID, team.ID, "created environment", properties.
		Set("environment", envID))

	c.JSON(http.StatusOK, env)
}

func (a *APIStore) GetEnvs(
	c *gin.Context,
) {
	ctx := c.Request.Context()

	userID := c.Value(constants.UserIDContextKey).(string)
	team, err := a.supabase.GetDefaultTeamFromUserID(userID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	SetAttributes(ctx, attribute.String("env.user_id", userID), attribute.String("env.team_id", team.ID))

	envs, err := a.supabase.GetEnvs(team.ID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting envs: %s", err))

		err = fmt.Errorf("error when getting envs: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	ReportEvent(ctx, "listed environments")

	a.IdentifyAnalyticsTeam(team.ID)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.CreateAnalyticsUserEvent(userID, team.ID, "listed environments", properties)

	c.JSON(http.StatusOK, envs)
}

func (a *APIStore) GetEnvsEnvID(
	c *gin.Context,
	envID string,
) {
	ctx := c.Request.Context()

	userID := c.Value(constants.UserIDContextKey).(string)
	team, err := a.supabase.GetDefaultTeamFromUserID(userID)

	SetAttributes(ctx, attribute.String("env.user_id", userID), attribute.String("env.team_id", team.ID))

	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)

		return
	}

	env, err := a.supabase.GetEnv(envID, team.ID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting env: %s", err))

		err = fmt.Errorf("error when getting env: %w", err)
		ReportCriticalError(ctx, err)

		return
	}
	if env == nil {
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error when getting env: %s", err))

		err = fmt.Errorf("error when getting env: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	ReportEvent(ctx, "got environment detail")

	a.IdentifyAnalyticsTeam(team.ID)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.CreateAnalyticsUserEvent(userID, team.ID, "got environment detail", properties.Set("environment", envID))

	c.JSON(http.StatusOK, env)
}
