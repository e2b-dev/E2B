package handlers

import (
	"fmt"
	"net/http"
	"os"
	"sync"

	"github.com/devbookhq/orchestration-services/api/internal/api"
	"github.com/devbookhq/orchestration-services/api/pkg/nomad"
	"github.com/devbookhq/orchestration-services/api/pkg/supabase"
	"github.com/gin-gonic/gin"
)

type APIStore struct {
	sessionsCache *nomad.SessionCache
	nomadClient   *nomad.NomadClient
  supabase      *supabase.Client
	NextId        int64
	Lock          sync.Mutex
}

func NewAPIStore() *APIStore {
	nomadClient := nomad.InitNomadClient()
  supabaseClient, err := supabase.NewClient()
  if err != nil {
    panic(err)
  }

	var initialSessions []*api.Session
	initialSessions, err = nomadClient.GetSessions()
	if err != nil {
		initialSessions = []*api.Session{}
		fmt.Fprintf(os.Stderr, "Error loading current sessions from Nomad\n: %s", err)
	}

	cache := nomad.NewSessionCache(nomadClient.DeleteSession, initialSessions)

	return &APIStore{
		nomadClient:   nomadClient,
    supabase:      supabaseClient,
		NextId:        1000,
		sessionsCache: cache,
	}
}

// This function wraps sending of an error in the Error format, and
// handling the failure to marshal that.
func sendAPIStoreError(c *gin.Context, code int, message string) {

	apiErr := api.Error{
		Code:    int32(code),
		Message: message,
	}

	c.JSON(code, apiErr)
}

func (a *APIStore) Get(c *gin.Context) {
	c.String(http.StatusOK, "Health check successful")
}
