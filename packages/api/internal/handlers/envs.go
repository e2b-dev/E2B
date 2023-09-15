package handlers

import (
	"fmt"
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

	// Not implemented yet
	envID := c.PostForm("envID")
	if envID != "" {
		a.sendAPIStoreError(c, http.StatusNotImplemented, "Updating envs is not implemented yet")

		return
	}

	// Prepare info for new env
	envID = utils.GenerateID()
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

	// Upload file to cloud storage
	url, err := a.uploadDockerContextFile(envID, team.ID, fileHandler.Filename, fileContent)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when uploading file: %s", err))

		return
	}

	// TODO: Create env, replace the print statement
	fmt.Println("Creating env", url)
	//a.nomad.StartBuildingEnv(a.tracer, ctx, envID, url)
	// Save env to database
	newEnv, err := a.supabase.CreateEnv(envID, team.ID, c.PostForm("dockerfile"))
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when creating env: %s", err))

		return
	}

	c.JSON(http.StatusOK, newEnv)
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
