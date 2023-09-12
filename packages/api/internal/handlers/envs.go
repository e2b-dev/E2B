package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/e2b-dev/api/packages/api/internal/api"

	"github.com/e2b-dev/api/packages/api/internal/constants"
	"github.com/gin-gonic/gin"
)

func (a *APIStore) PostEnvs(
	c *gin.Context,
) {
	ctx := c.Request.Context()

	body, err := parseBody[api.PostEnvsMultipartRequestBody](ctx, c)

	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))

		return
	}

	if !strings.HasSuffix(body.BuildContext.Filename(), ".tar.gz") {
		a.sendAPIStoreError(c, http.StatusBadRequest, "Build context must be a tar.gz file")

		return
	}

	// Not implemented yet
	if body.EnvID != nil {
		a.sendAPIStoreError(c, http.StatusNotImplemented, "Updating envs is not implemented yet")

		return
	}

	userID := ctx.Value(constants.UserIDContextKey).(string)
	team, err := a.supabase.GetDefaultTeamFromUserID(userID)

	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		return
	}

	newEnv, err := a.supabase.CreateEnv(*body.EnvID, team.ID, body.Dockerfile)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when creating env: %s", err))

		return
	}

	c.JSON(http.StatusOK, newEnv)
}
