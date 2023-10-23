package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/storage"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/db"
	"github.com/e2b-dev/infra/packages/api/internal/nomad"
	"github.com/e2b-dev/infra/packages/api/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/posthog/posthog-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

type APIStore struct {
	Ctx                        context.Context
	posthog                    posthog.Client
	tracer                     trace.Tracer
	cache                      *nomad.InstanceCache
	nomad                      *nomad.NomadClient
	supabase                   *db.DB
	cloudStorage               *cloudStorage
	buildCache                 *utils.BuildCache
	apiSecret                  string
	googleServiceAccountBase64 string
}

func NewAPIStore() *APIStore {
	fmt.Println("Initializing API store")

	ctx := context.Background()

	tracer := otel.Tracer("api")

	nomadClient := nomad.InitNomadClient()

	fmt.Println("Initialized Nomad client")

	supabaseClient, err := db.NewClient(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing Supabase client\n: %s", err)
		panic(err)
	}

	fmt.Println("Initialized Supabase client")

	posthogAPIKey := os.Getenv("POSTHOG_API_KEY")
	posthogVerbose := true
	posthogLogger := posthog.StdLogger(log.New(os.Stderr, "posthog ", log.LstdFlags))

	if posthogAPIKey == "" {
		fmt.Println("No Posthog API key provided, silencing logs")

		posthogVerbose = false
		writer := &utils.NoOpWriter{}
		posthogLogger = posthog.StdLogger(log.New(writer, "posthog ", log.LstdFlags))
	}

	posthogClient, posthogErr := posthog.NewWithConfig(posthogAPIKey, posthog.Config{
		Interval:  30 * time.Second,
		BatchSize: 100,
		Verbose:   posthogVerbose,
		Logger:    posthogLogger,
	})

	if posthogErr != nil {
		fmt.Printf("Error initializing Posthog client\n: %s", posthogErr)
		panic(posthogErr)
	}

	var initialInstances []*api.Instance

	if os.Getenv("ENVIRONMENT") == "prod" {
		instances, instancesErr := nomadClient.GetInstances()
		if instancesErr != nil {
			fmt.Fprintf(os.Stderr, "Error loading current sessions from Nomad\n: %+v", instancesErr.Err)
		}

		initialInstances = instances
	} else {
		fmt.Println("Skipping loading sessions from Nomad, running locally")
	}

	cache := nomad.NewInstanceCache(getDeleteInstanceFunction(nomadClient, posthogClient), initialInstances)

	if os.Getenv("ENVIRONMENT") == "prod" {
		go cache.KeepInSync(nomadClient)
	} else {
		fmt.Println("Skipping syncing sessions with Nomad, running locally")
	}

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

	apiSecret := os.Getenv("API_SECRET")
	if apiSecret == "" {
		apiSecret = "SUPER_SECR3T_4PI_K3Y"
	}

	buildCache := utils.NewBuildCache()

	return &APIStore{
		Ctx:                        ctx,
		nomad:                      nomadClient,
		supabase:                   supabaseClient,
		cache:                      cache,
		tracer:                     tracer,
		posthog:                    posthogClient,
		cloudStorage:               cStorage,
		apiSecret:                  apiSecret,
		buildCache:                 buildCache,
		googleServiceAccountBase64: os.Getenv("GOOGLE_SERVICE_ACCOUNT_BASE64"),
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
	teamID, err := a.supabase.GetTeamID(apiKey)
	if err != nil {
		return "", fmt.Errorf("failed to get get team from db for api key: %w", err)
	}

	if teamID == "" {
		return "", fmt.Errorf("failed to get a team from api key")
	}

	return teamID, nil
}

func (a *APIStore) GetUserFromAccessToken(accessToken string) (string, error) {
	userID, err := a.supabase.GetUserID(accessToken)
	if err != nil {
		return "", fmt.Errorf("failed to get get user from db for access token: %w", err)
	}

	if userID == "" {
		return "", fmt.Errorf("failed to get a user from access token")
	}

	return userID, nil
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
	delErr := nomad.DeleteInstance(instanceID, purge)
	if delErr != nil {
		errMsg := fmt.Errorf("cannot delete session '%s': %w", instanceID, delErr.Err)

		return &api.APIError{
			Err:       errMsg,
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
