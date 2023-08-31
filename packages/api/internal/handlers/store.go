package handlers

import (
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/devbookhq/devbook-api/packages/api/internal/api"
	"github.com/devbookhq/devbook-api/packages/api/internal/nomad"
	"github.com/devbookhq/devbook-api/packages/api/internal/supabase"

	"github.com/gin-gonic/gin"
	"github.com/posthog/posthog-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

type APIStore struct {
	sessionsCache *nomad.SessionCache
	nomad         *nomad.NomadClient
	supabase      *supabase.DB
	NextId        int64
	Lock          sync.Mutex
	tracer        trace.Tracer
	templates     *[]string
	posthog       posthog.Client
}

var posthogAPIKey = os.Getenv("POSTHOG_API_KEY")

func NewAPIStore() *APIStore {
	fmt.Println("Initializing API store")

	tracer := otel.Tracer("api")

	nomadClient := nomad.InitNomadClient()
	fmt.Println("Initialized Nomad client")
	supabaseClient, err := supabase.NewClient()
	if err != nil {
		panic(err)
	}
	fmt.Println("Initialized Supabase client")

	// Uncomment this to rebuild templates
	// Keep this commented out in production to prevent rebuilding templates on restart
	// TODO: Build only templates that changed
	// go func() {
	// 	err := nomadClient.RebuildTemplates(tracer)
	// 	if err != nil {
	// 		fmt.Fprintf(os.Stderr, "Error rebuilding templates\n: %s", err)
	// 	}
	// }()
	templates, templatesErr := nomad.GetTemplates()
	if templatesErr != nil {
		fmt.Fprintf(os.Stderr, "Error loading templates\n: %s", templatesErr)
		panic(templatesErr)
	}
	var initialSessions []*api.Session
	initialSessions, sessionErr := nomadClient.GetSessions()
	if sessionErr != nil {
		initialSessions = []*api.Session{}
		fmt.Fprintf(os.Stderr, "Error loading current sessions from Nomad\n: %s", sessionErr)
	}

	posthogAPIKey := os.Getenv("POSTHOG_API_KEY")
	posthogClient, posthogErr := posthog.NewWithConfig(posthogAPIKey, posthog.Config{
		Interval:  30 * time.Second,
		BatchSize: 100,
		Verbose:   true,
	})

	if posthogErr != nil {
		fmt.Printf("Error initializing Posthog client\n: %s", posthogErr)
		panic(posthogErr)
	}

	cache := nomad.NewSessionCache(getDeleteSessionFunction(nomadClient, posthogClient), initialSessions)
	// Comment this line out if you are developing locally to prevent killing sessions in production
	go cache.KeepInSync(nomadClient)

	return &APIStore{
		nomad:         nomadClient,
		supabase:      supabaseClient,
		NextId:        1000,
		sessionsCache: cache,
		tracer:        tracer,
		templates:     templates,
		posthog:       posthogClient,
	}
}

func (a *APIStore) Close() {
	a.nomad.Close()
	a.supabase.Close()
	err := a.posthog.Close()
	if err != nil {
		fmt.Printf("Error closing Posthog client\n: %s", err)
	}
}

func (a *APIStore) validateAPIKey(apiKey *string) (string, bool, error) {
	if apiKey == nil {
		return "", false, fmt.Errorf("no API key")
	}

	if *apiKey == "" {
		return "", false, fmt.Errorf("no API key")
	}

	if *apiKey == api.APIAdminKey {
		return "admin", true, nil
	}

	user, err := a.supabase.GetUserID(*apiKey)

	if err != nil || user == nil {
		return "", false, fmt.Errorf("error validating API key: %+v", err)
	}

	return user.ID, false, nil
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

func (a *APIStore) isOwner(codeSnippetID string, userID string) (bool, error) {
	codeSnippets, err := a.supabase.GetCodeSnippets(userID)
	if err != nil {
		return false, fmt.Errorf("error getting code snippets from Supabase: %+v", err)
	}

	found := false
	for _, v := range *codeSnippets {
		if v.ID == codeSnippetID {
			found = true
		}
	}

	return found, nil
}

func (a *APIStore) isPredefinedTemplate(codeSnippetID string) bool {
	for _, s := range *a.templates {
		if s == codeSnippetID {
			return true
		}
	}
	return false
}

func (a *APIStore) validateTeamAPIKey(apiKey *string) *string {
	if apiKey == nil {
		fmt.Println("No api key provided")
		return nil
	}
	team, err := a.supabase.GetTeamID(*apiKey)
	if err != nil {
		fmt.Printf("Failed to get a team from api key: %+v\n", err)
		return nil
	}
	return &team.ID
}

func (a *APIStore) DeleteSession(sessionID string, purge bool) *api.APIError {
	sessionData := a.sessionsCache.Get(sessionID)
	return deleteSession(a.nomad, a.posthog, sessionID, sessionData.TeamID, sessionData.StartTime, purge)
}

type sessionData = nomad.SessionData

func getDeleteSessionFunction(nomad *nomad.NomadClient, posthogClient posthog.Client) func(sessionData sessionData, purge bool) *api.APIError {
	return func(sessionData sessionData, purge bool) *api.APIError {
		return deleteSession(nomad, posthogClient, sessionData.Session.SessionID, sessionData.TeamID, sessionData.StartTime, purge)
	}
}
func deleteSession(nomad *nomad.NomadClient, posthogClient posthog.Client, sessionID string, teamID *string, startTime *time.Time, purge bool) *api.APIError {
	err := nomad.DeleteSession(sessionID, purge)
	if err != nil {
		return &api.APIError{
			Msg:       fmt.Sprintf("cannot delete session '%s': %+v", sessionID, err),
			ClientMsg: "Cannot delete the session right now",
			Code:      http.StatusInternalServerError,
		}
	}

	if teamID != nil && startTime != nil {
		err := posthogClient.Enqueue(posthog.Capture{
			DistinctId: "backend",
			Event:      "closed_session",
			Properties: posthog.NewProperties().
				Set("session_id", sessionID).Set("duration", time.Since(*startTime).Seconds()),
			Groups: posthog.NewGroups().
				Set("team", teamID),
		})
		if err != nil {
			fmt.Printf("Error sending Posthog event: %s", err)
		}
	}
	return nil
}
