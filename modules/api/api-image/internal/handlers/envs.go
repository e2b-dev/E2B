package handlers

import (
	"fmt"
	"net/http"

	"github.com/devbookhq/orchestration-services/modules/api/api-image/internal/api"
	"github.com/gin-gonic/gin"
)

func (p *APIStore) PostEnv(c *gin.Context) {
	// TODO: Check for API token

	var env api.Environment
	if err := c.Bind(&env); err != nil {
		sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	// TODO: Download the base Dockerfile based on a runtime field in `env`.
	// TODO: Add deps to the Dockerfile.
	evalID, err := p.nomad.RegisterFCEnvJob(env.CodeSnippetID, string(env.Runtime), env.Deps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, struct{ Error string }{err.Error()})
		return
	}

	c.JSON(http.StatusOK, struct{ EvalID string }{evalID})
}

func (p *APIStore) GetEnvsCodeSnippetID(c *gin.Context, codeSnippetID string) {

}

func (p *APIStore) PostEnvsCodeSnippetIDStatus(c *gin.Context, codeSnippetID string) {

}
