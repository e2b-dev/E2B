package handlers

import (
	"cloud.google.com/go/storage"
	"context"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/e2b-dev/api/packages/api/internal/api"
	"github.com/e2b-dev/api/packages/api/internal/db"
	"github.com/e2b-dev/api/packages/api/internal/nomad"

	"github.com/gin-gonic/gin"
	"github.com/posthog/posthog-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

type APIStore struct {
	cache        *nomad.InstanceCache
	nomad        *nomad.NomadClient
	supabase     *db.DB
	posthog      posthog.Client
	NextId       int64
	Lock         sync.Mutex
	tracer       trace.Tracer
	templates    *[]string
	cloudStorage *cloudStorage
}

func NewAPIStore() *APIStore {
	fmt.Println("Initializing API store")

	tracer := otel.Tracer("api")

	nomadClient := nomad.InitNomadClient()

	fmt.Println("Initialized Nomad client")

	supabaseClient, err := db.NewClient()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing Supabase client\n: %s", err)
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

	var initialInstances []*api.Instance

	if os.Getenv("ENVIRONMENT") == "prod" {
		var instancesErr error
		initialInstances, instancesErr = nomadClient.GetInstances()
		if instancesErr != nil {
			fmt.Fprintf(os.Stderr, "Error loading current sessions from Nomad\n: %s", instancesErr)
		}
	} else {
		fmt.Println("Skipping loading sessions from Nomad, running locally")
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

	cache := nomad.NewInstanceCache(getDeleteInstanceFunction(nomadClient, posthogClient), initialInstances)

	if os.Getenv("ENVIRONMENT") == "prod" {
		go cache.KeepInSync(nomadClient)
	} else {
		fmt.Println("Skipping syncing sessions with Nomad, running locally")
	}

	ctx := context.Background()
	storageClient, err := storage.NewClient(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing Cloud Storage client\n: %s", err)
		panic(err)
	}

	cStorage := &cloudStorage{
		bucket:  os.Getenv("GOOGLE_CLOUD_STORAGE_BUCKET"),
		client:  storageClient,
		context: ctx,
	}

	return &APIStore{
		nomad:        nomadClient,
		supabase:     supabaseClient,
		NextId:       1000,
		cache:        cache,
		tracer:       tracer,
		templates:    templates,
		posthog:      posthogClient,
		cloudStorage: cStorage,
	}
}

func (a *APIStore) Close() {
	a.nomad.Close()
	a.supabase.Close()

	err := a.posthog.Close()
	if err != nil {
		fmt.Printf("Error closing Posthog client\n: %s", err)
	}
	err = a.cloudStorage.client.Close()
	if err != nil {
		fmt.Printf("Error closing Cloud Storage client\n: %s", err)
	}
}

// This function wraps sending of an error in the Error format, and
// handling the failure to marshal that.
func (a *APIStore) sendAPIStoreError(c *gin.Context, code int, message string) {
	apiErr := api.Error{
		Code:    int32(code),
		Message: message,
	}

	err := c.Error(fmt.Errorf(message))
	if err != nil {
		fmt.Printf("Error sending error: %s", err)
	}

	c.JSON(code, apiErr)
}

func (a *APIStore) GetHealth(c *gin.Context) {
	c.String(http.StatusOK, "Health check successful")
}

func (a *APIStore) GetTeamFromAPIKey(apiKey string) (string, error) {
	team, err := a.supabase.GetTeamID(apiKey)
	if err != nil {
		return "", fmt.Errorf("failed to get get team from db for api key: %w", err)
	}

	if team == nil {
		return "", fmt.Errorf("failed to get a team from api key")
	}

	return team.ID, nil
}

func (a *APIStore) GetUserFromAccessToken(accessToken string) (string, error) {
	user, err := a.supabase.GetUserID(accessToken)
	if err != nil {
		return "", fmt.Errorf("failed to get get user from db for access token: %w", err)
	}

	if user == nil {
		return "", fmt.Errorf("failed to get a user from access token")
	}

	return user.ID, nil
}

func (a *APIStore) GetTeamIDFromUserID(userID string) (string, error) {
	user, err := a.supabase.GetTeamID(userID)
	if err != nil {
		return "", fmt.Errorf("failed to get get user from db for access token: %w", err)
	}

	if user == nil {
		return "", fmt.Errorf("failed to get a user from access token")
	}

	return user.ID, nil
}

func (a *APIStore) DeleteInstance(instanceID string, purge bool) *api.APIError {
	info := a.cache.Get(instanceID)

	return deleteInstance(a.nomad, a.posthog, instanceID, info.TeamID, info.StartTime, purge)
}

func (a *APIStore) CheckTeamAccessEnv(envID string, teamID string, public bool) (bool, error) {
	return a.supabase.HasEnvAccess(envID, teamID, public)
}

type InstanceInfo = nomad.InstanceInfo

func getDeleteInstanceFunction(nomad *nomad.NomadClient, posthogClient posthog.Client) func(info nomad.InstanceInfo, purge bool) *api.APIError {
	return func(info InstanceInfo, purge bool) *api.APIError {
		return deleteInstance(nomad, posthogClient, info.Instance.InstanceID, info.TeamID, info.StartTime, purge)
	}
}

func deleteInstance(nomad *nomad.NomadClient, posthogClient posthog.Client, instanceID string, teamID *string, startTime *time.Time, purge bool) *api.APIError {
	err := nomad.DeleteInstance(instanceID, purge)
	if err != nil {
		return &api.APIError{
			Msg:       fmt.Sprintf("cannot delete session '%s': %+v", instanceID, err),
			ClientMsg: "Cannot delete the session right now",
			Code:      http.StatusInternalServerError,
		}
	}

	if teamID != nil && startTime != nil {
		err := posthogClient.Enqueue(posthog.Capture{
			DistinctId: "backend",
			Event:      "closed_session",
			Properties: posthog.NewProperties().
				Set("session_id", instanceID).Set("duration", time.Since(*startTime).Seconds()),
			Groups: posthog.NewGroups().
				Set("team", teamID),
		})
		if err != nil {
			fmt.Printf("Error sending Posthog event: %s", err)
		}
	}
	return nil
}

func (a *APIStore) GetPackageToPosthogProperties(header *http.Header) posthog.Properties {
	properties := posthog.NewProperties().
		Set("package_version", header.Get("package_version")).
		Set("lang", header.Get("lang")).
		Set("lang_version", header.Get("lang_version")).
		Set("system", header.Get("system")).
		Set("os", header.Get("os")).
		Set("publisher", header.Get("publisher")).
		Set("release", header.Get("release")).
		Set("machine", header.Get("machine")).
		Set("processor", header.Get("processor"))

	return properties
}
