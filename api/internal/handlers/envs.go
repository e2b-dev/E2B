package handlers

import (
	"fmt"
	"net/http"

	"github.com/devbookhq/orchestration-services/api/internal/api"
	"github.com/gin-gonic/gin"
)

func (a *APIStore) PostEnvs(c *gin.Context) {
	// TODO: Check for API token

	var env api.Environment
	if err := c.Bind(&env); err != nil {
		sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	// TODO: Download the base Dockerfile based on a template field in `env`.
	// TODO: Add deps to the Dockerfile.
	evalID, err := a.nomadClient.RegisterFCEnvJob(env.CodeSnippetID, string(env.Template), env.Deps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, struct{ Error string }{err.Error()})
		return
	}

	c.JSON(http.StatusOK, struct{ EvalID string }{evalID})
}

func (a *APIStore) GetEnvsCodeSnippetID(c *gin.Context, codeSnippetID string) {

}

func (a *APIStore) PostEnvsCodeSnippetIDStatus(c *gin.Context, codeSnippetID string) {

}
