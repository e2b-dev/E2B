package api

import (
	"net/http"
	"sync"
  "fmt"

	//"api/pkg/nomad"
  "github.com/devbookhq/orchestration-services/modules/api/api-image/pkg/nomad"

	"github.com/gin-gonic/gin"
)

type APIStore struct {
	nomad  *nomad.Nomad
	NextId int64
	Lock   sync.Mutex
}

func NewAPIStore(nomad *nomad.Nomad) *APIStore {
	return &APIStore{
		nomad:  nomad,
		NextId: 1000,
	}
}

// This function wraps sending of an error in the Error format, and
// handling the failure to marshal that.
func sendAPIStoreError(c *gin.Context, code int, message string) {
	apiErr := Error{
		Code:    int32(code),
		Message: message,
	}

	c.JSON(code, apiErr)
}

func (p *APIStore) Get(c *gin.Context) {
	c.String(http.StatusOK, "Health check successful")
}

func (p *APIStore) GetSessions(c *gin.Context) {
	sessions, _, err := p.nomad.GetSessions(nomad.SessionJobID)

	if err != nil {
		sendAPIStoreError(c, http.StatusInternalServerError, "Error listing sessions")
		return
	}

	c.JSON(http.StatusOK, sessions)
}

func (p *APIStore) PostSessions(c *gin.Context) {
	session, _, err := p.nomad.CreateSession(nomad.SessionJobID)

	if err != nil {
		sendAPIStoreError(c, http.StatusInternalServerError, "Error creating session")
		return
	}

	c.JSON(http.StatusCreated, Session{SessionId: session.DispatchedJobID})
}

func (p *APIStore) DeleteSessionsSessionId(c *gin.Context, id string) {
	_, _, err := p.nomad.DeleteSession(nomad.SessionJobID)

	if err != nil {
		sendAPIStoreError(c, http.StatusInternalServerError, "Error deleting session")
		return
	}

	c.JSON(http.StatusOK, Session{SessionId: id})
}

func (p *APIStore) PostEnv(c *gin.Context) {
  // TODO: Check for API token

  var env Environment
  if err := c.Bind(&env); err != nil {
    sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
    return
  }

  // TODO: Download the base Dockerfile based on a runtime field in `env`.

  // TODO: Add deps to the Dockerfile.
  //dockerfile := ""
  //env, _, err := p.nomad.CreateEnvironment(env.CodeSnippetId, dockerfile)
  p.nomad.CreateEnvironment(env.CodeSnippetId, string(env.Runtime))


	//c.JSON(http.StatusOK, Session{SessionId: id})
	c.JSON(http.StatusOK, Session{SessionId: "dummy"})
}
