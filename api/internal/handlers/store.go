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
	initialSessions, sessionErr := nomadClient.GetSessions()
	if sessionErr != nil {
		initialSessions = []*api.Session{}
		fmt.Fprintf(os.Stderr, "Error loading current sessions from Nomad\n: %s", err)
	}

	cache := nomad.NewSessionCache(nomadClient.DeleteSession, initialSessions)

	cache.KeepInSync(nomadClient)

	return &APIStore{
		nomadClient:   nomadClient,
		supabase:      supabaseClient,
		NextId:        1000,
		sessionsCache: cache,
	}
}

func (a *APIStore) validateAPIKey(apiKey string) (*string, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("no API key")
	}

	result := []*struct {
		owner_id string
	}{}

	err := a.supabase.DB.
		From("api_keys").
		Select("owner_id").
		Eq("api_key", apiKey).
		Execute(result)

	if err != nil {
		return nil, fmt.Errorf("error validating API key: %+v", err)
	}

	if len(result) == 0 {
		return nil, fmt.Errorf("no user for the API key found: %+v", err)
	}

	if len(result) > 1 {
		return nil, fmt.Errorf("more users have the same API key: %+v", err)
	}
	return &result[0].owner_id, nil
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

func (a *APIStore) GetHealth(c *gin.Context) {
	c.String(http.StatusOK, "Health check successful")
}
