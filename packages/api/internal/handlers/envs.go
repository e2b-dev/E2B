package handlers

import (
	"fmt"
	"github.com/e2b-dev/api/packages/api/internal/api"
	"github.com/e2b-dev/api/packages/api/internal/constants"
	"github.com/e2b-dev/api/packages/api/internal/utils"
	"github.com/gin-gonic/gin"
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

		return
	}

	fileContent, fileHandler, err := c.Request.FormFile("buildContext")
	if err != nil {
		formErr := fmt.Errorf("error when parsing form data: %w", err)
		ReportCriticalError(ctx, formErr)
		return
	}
	defer fileContent.Close()

	// Check if file is a tar.gz file
	if !strings.HasSuffix(fileHandler.Filename, ".tar.gz.e2b") {
		a.sendAPIStoreError(c, http.StatusBadRequest, "Build context must be a tar.gz.e2b file")

		return
	}

	var env *api.Environment
	envID := c.PostForm("envID")
	if envID == "" {
		envID = utils.GenerateID()
		env, err = a.supabase.CreateEnv(envID, team.ID, c.PostForm("dockerfile"))

		if err != nil {
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when creating env: %s", err))

			return
		}
	} else {
		hasAccess, err := a.supabase.HasEnvAccess(envID, team.ID, false)
		if err != nil {
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when checking team access: %s", err))

			return
		}
		if !hasAccess {
			a.sendAPIStoreError(c, http.StatusForbidden, "You don't have access to this environment")

			return
		}
		env, err = a.supabase.UpdateEnv(envID, c.PostForm("dockerfile"))

		if err != nil {
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when updating envs: %s", err))

			return
		}
	}

	// Upload and build env
	go a.buildEnvs(ctx, envID, fileHandler.Filename, fileContent)
	c.JSON(http.StatusOK, env)
}

func (a *APIStore) GetEnvs(
	c *gin.Context,
) {
	userID := c.Value(constants.UserIDContextKey).(string)
	team, err := a.supabase.GetDefaultTeamFromUserID(userID)

	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		return
	}

	envs, err := a.supabase.GetEnvs(team.ID)

	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting envs: %s", err))

		return
	}
	c.JSON(http.StatusOK, envs)
}

func (a *APIStore) GetEnvsEnvID(
	c *gin.Context,
	envID string,
) {
	userID := c.Value(constants.UserIDContextKey).(string)
	team, err := a.supabase.GetDefaultTeamFromUserID(userID)

	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		return
	}

	env, err := a.supabase.GetEnv(envID, team.ID)

	if err != nil {
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error when getting envs: %s", err))

		return
	}
	c.JSON(http.StatusOK, env)
}
