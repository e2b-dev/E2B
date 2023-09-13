package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/e2b-dev/api/packages/api/internal/constants"
	"github.com/gin-gonic/gin"
)

func (a *APIStore) PostEnvs(
	c *gin.Context,
) {
	ctx := c.Request.Context()

	file, err := c.FormFile("buildContext")
	if err != nil {
		formErr := fmt.Errorf("error when parsing form data: %w", err)
		ReportCriticalError(ctx, formErr)
		return
	}

	if !strings.HasSuffix(file.Filename, ".tar.gz") {
		a.sendAPIStoreError(c, http.StatusBadRequest, "Build context must be a tar.gz file")

		return
	}

	// Not implemented yet
	envID := c.PostForm("envID")
	if envID != "" {
		a.sendAPIStoreError(c, http.StatusNotImplemented, "Updating envs is not implemented yet")

		return
	}

	userID := c.Value(constants.UserIDContextKey).(string)
	team, err := a.supabase.GetDefaultTeamFromUserID(userID)

	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		return
	}

	newEnv, err := a.supabase.CreateEnv(envID, team.ID, c.PostForm("dockerfile"))
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when creating env: %s", err))

		return
	}

	c.JSON(http.StatusOK, newEnv)
}
