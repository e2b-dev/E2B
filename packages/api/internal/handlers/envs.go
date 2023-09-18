package handlers

import (
	"fmt"
	"github.com/e2b-dev/api/packages/api/internal/api"
	"github.com/e2b-dev/api/packages/api/internal/constants"
	"github.com/e2b-dev/api/packages/api/internal/utils"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
	"net/http"
	"strings"
)

func (a *APIStore) PostEnvs(
	c *gin.Context,
) {
	ctx := c.Request.Context()

	// Prepare info for new env
	userID := c.Value(constants.UserIDContextKey).(string)
	team, err := a.supabase.GetDefaultTeamFromUserID(userID)

	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	SetAttributes(ctx, attribute.String("env.user_id", userID), attribute.String("env.team_id", team.ID))

	fileContent, fileHandler, err := c.Request.FormFile("buildContext")
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, "Error when parsing form data")

		err = fmt.Errorf("error when parsing form data: %w", err)
		ReportCriticalError(ctx, err)

		return
	}
	defer fileContent.Close()

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
		env, err = a.supabase.CreateEnv(envID, team.ID, c.PostForm("dockerfile"))

		if err != nil {
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when creating env: %s", err))

			err = fmt.Errorf("error when creating env: %w", err)
			ReportCriticalError(ctx, err)

			return
		}
		ReportEvent(ctx, "created new environment")
	} else {
		hasAccess, err := a.supabase.HasEnvAccess(envID, team.ID, false)
		if err != nil {
			a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("The environment '%s' does not exist", envID))

			err = fmt.Errorf("error env not found: %w", err)
			ReportError(ctx, err)

			return
		}
		if !hasAccess {
			a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this environment")

			err = fmt.Errorf("user doesn't have access to env: %w", err)
			ReportError(ctx, err)

			return
		}
		env, err = a.supabase.UpdateDockerfileEnv(envID, c.PostForm("dockerfile"))

		if err != nil {
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when updating envs: %s", err))

			err = fmt.Errorf("error when updating envs: %w", err)
			ReportCriticalError(ctx, err)

			return
		}
		ReportEvent(ctx, "updated environment")

	}

	// Upload and build env
	go a.buildEnvs(ctx, envID, fileHandler.Filename, fileContent)
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
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error when getting env: %s", err))

		err = fmt.Errorf("error when getting env: %w", err)
		ReportError(ctx, err)
		return
	}

	ReportEvent(ctx, "got environment detail")

	a.IdentifyAnalyticsTeam(team.ID)
	properties := a.GetPackageToPosthogProperties(&c.Request.Header)
	a.CreateAnalyticsUserEvent(userID, team.ID, "got environment detail", properties.Set("environment", envID))

	c.JSON(http.StatusOK, env)
}
