package handlers

import (
	"fmt"
	"net/http"
	"os"
	"sync"

	"github.com/devbookhq/devbook-api/packages/api/internal/api"
	"github.com/devbookhq/devbook-api/packages/api/pkg/nomad"
	"github.com/devbookhq/devbook-api/packages/api/pkg/supabase"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

type APIStore struct {
	sessionsCache *nomad.SessionCache
	nomadClient   *nomad.NomadClient
	supabase      *supabase.Client
	NextId        int64
	Lock          sync.Mutex
	tracer        trace.Tracer
}

func NewAPIStore() *APIStore {
	fmt.Printf("Initializing API store")

	tracer := otel.Tracer("api")

	nomadClient := nomad.InitNomadClient()
	supabaseClient, err := supabase.NewClient()
	if err != nil {
		panic(err)
	}

	// TODO: Build only templates that changed
	go func() {
		err = nomadClient.RebuildTemplates(tracer)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error rebuilding templates\n: %s", err)
		}
	}()

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
		tracer:        tracer,
	}
}

func (a *APIStore) Close() {
	a.nomadClient.Close()
	a.supabase.Close()
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
func (a *APIStore) sendAPIStoreError(c *gin.Context, code int, message string) {
	apiErr := api.Error{
		Code:    int32(code),
		Message: message,
	}

	c.Error(fmt.Errorf(message))
	c.JSON(code, apiErr)
}

func (a *APIStore) GetHealth(c *gin.Context) {
	c.String(http.StatusOK, "Health check successful")
}
