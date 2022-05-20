package main

import (
	"fmt"
	"net/http"
	"os"
	"sync"

	"github.com/devbookhq/orchestration-services/modules/api/api-image/internal/handlers"
	"github.com/devbookhq/orchestration-services/modules/api/api-image/pkg/nomad"
	"github.com/devbookhq/orchestration-services/modules/api/api-image/pkg/refresh"
	"github.com/gin-gonic/gin"
)

type APIStore struct {
	sessionsCache *refresh.SessionCache
	nomad         *nomad.Nomad
	NextId        int64
	Lock          sync.Mutex
}

func NewAPIStore(nomad *nomad.Nomad) *APIStore {
	var initialSessions []*handlers.Session

	initialSessions, err := nomad.GetSessions()
	if err != nil {
		initialSessions = []*handlers.Session{}
		fmt.Fprintf(os.Stderr, "Error loading current sessions from Nomad\n: %s", err)
	}

	cache := refresh.NewSessionCache(nomad.DeleteSession, initialSessions)

	return &APIStore{
		nomad:         nomad,
		NextId:        1000,
		sessionsCache: cache,
	}
}

// This function wraps sending of an error in the Error format, and
// handling the failure to marshal that.
func sendAPIStoreError(c *gin.Context, code int, message string) {

	apiErr := handlers.Error{
		Code:    int32(code),
		Message: message,
	}

	c.JSON(code, apiErr)
}

func (p *APIStore) Get(c *gin.Context) {
	c.String(http.StatusOK, "Health check successful")
}

func (p *APIStore) PostEnv(c *gin.Context) {
	// TODO: Check for API token

	var env handlers.Environment
	if err := c.Bind(&env); err != nil {
		sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	// TODO: Download the base Dockerfile based on a runtime field in `env`.
	// TODO: Add deps to the Dockerfile.
	evalID, err := p.nomad.RegisterFCEnvJob(env.CodeSnippetId, string(env.Runtime), env.Deps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, struct{ Error string }{err.Error()})
		return
	}

	c.JSON(http.StatusOK, struct{ EvalID string }{evalID})
}
