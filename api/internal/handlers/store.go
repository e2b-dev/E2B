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

func (a *APIStore) validateAPIKey(apiKey *string) (string, error) {
	if apiKey == nil {
		return "", fmt.Errorf("no API key")
	}

	if *apiKey == "" {
		return "", fmt.Errorf("no API key")
	}

	if *apiKey == api.APIAdminKey {
		return "api_admin_key", nil
	}

	var result map[string]interface{}

	err := a.supabase.DB.
		From("api_keys").
		Select("owner_id").
		Single().
		Eq("api_key", *apiKey).
		Execute(&result)

	if err != nil || result == nil {
		return "", fmt.Errorf("error validating API key: %+v", err)
	}

	return result["owner_id"].(string), nil
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
