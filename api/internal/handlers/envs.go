package handlers

import (
	"fmt"
	"net/http"
  "encoding/json"


	"github.com/devbookhq/orchestration-services/api/internal/api"
	"github.com/gin-gonic/gin"
)

func (a *APIStore) PostEnvs(c *gin.Context) {
	// TODO: Check for API token

	var env api.NewEnvironment
	if err := c.Bind(&env); err != nil {
		sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	// TODO: Download the base Dockerfile based on a template field in `env`.
	// TODO: Add deps to the Dockerfile.
	err := a.nomadClient.RegisterFCEnvJob(env.CodeSnippetID, string(env.Template), env.Deps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, struct{ Error string }{err.Error()})
		return
	}

	c.JSON(http.StatusOK, struct{}{})
}

func (a *APIStore) DeleteEnvs(c *gin.Context) {
  // TODO: Delete env from DB
  // TODO: Start a nomad job to cleanup files
  var body api.DeleteEnvironment
	if err := c.Bind(&body); err != nil {
		sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

  err := a.supabase.DB.
    From("envs").
    Delete().
    Eq("code_snippet_id", body.CodeSnippetID).
    Execute(nil)
  if err != nil {
    fmt.Printf("error: %v\n", err)
		sendAPIStoreError(
      c,
      http.StatusBadRequest,
      fmt.Sprintf("Failed to delete env for code snippet '%s': %s", body.CodeSnippetID, err),
    )
		return
  }

	err = a.nomadClient.RegisterFCEnvDeleterJob(body.CodeSnippetID)
	if err != nil {
    fmt.Printf("error: %v\n", err)
		c.JSON(http.StatusInternalServerError, struct{ Error string }{err.Error()})
		return
	}

	c.JSON(http.StatusOK, struct{}{})
}

func (a *APIStore) GetEnvsCodeSnippetID(c *gin.Context, codeSnippetID string) {

}

func (a *APIStore) PostEnvsState(c *gin.Context) {
	// TODO: Check for API token

  var envStateUpdate api.EnvironmentStateUpdate
	if err := c.Bind(&envStateUpdate); err != nil {
		sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

  body := map[string]interface{}{ "state": envStateUpdate.State }
  err := a.supabase.DB.
    From("envs").
    Update(body).
    Eq("code_snippet_id", envStateUpdate.CodeSnippetID).
    Execute(nil)

  if err != nil {
    if e, ok := err.(*json.SyntaxError); ok {
      fmt.Printf("syntax error at byte offset %d", e.Offset)
    }
    fmt.Printf("error: %v\n", err)
		sendAPIStoreError(
      c,
      http.StatusBadRequest,
      fmt.Sprintf("Failed to update env for code snippet '%s': %s", envStateUpdate.CodeSnippetID, err),
    )
		return
  }

	c.JSON(http.StatusNoContent, struct{}{})
}
