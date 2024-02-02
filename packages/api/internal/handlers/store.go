package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	artifactregistry "cloud.google.com/go/artifactregistry/apiv1"
	"cloud.google.com/go/storage"
	"github.com/e2b-dev/infra/packages/shared/pkg/env"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/posthog/posthog-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/e2b-dev/infra/packages/api/internal/analytics_collector"
	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/db"
	"github.com/e2b-dev/infra/packages/api/internal/nomad"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
)

type APIStore struct {
	Ctx                        context.Context
	analytics                  *analyticscollector.Analytics
	posthog                    posthog.Client
	tracer                     trace.Tracer
	instanceCache              *nomad.InstanceCache
	buildCache                 *nomad.BuildCache
	nomad                      *nomad.NomadClient
	supabase                   *db.DB
	cloudStorage               *cloudStorage
	artifactRegistry           *artifactregistry.Client
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
		fmt.Fprintf(os.Stderr, "Error initializing Supabase client\n: %v\n", err)
		panic(err)
	}

	fmt.Println("Initialized Supabase client")

	posthogAPIKey := os.Getenv("POSTHOG_API_KEY")
	posthogLogger := posthog.StdLogger(log.New(os.Stderr, "posthog ", log.LstdFlags))

	if posthogAPIKey == "" {
		fmt.Println("No Posthog API key provided, silencing logs")

		writer := &utils.NoOpWriter{}
		posthogLogger = posthog.StdLogger(log.New(writer, "posthog ", log.LstdFlags))
	}

	posthogClient, posthogErr := posthog.NewWithConfig(posthogAPIKey, posthog.Config{
		Interval:  30 * time.Second,
		BatchSize: 100,
		Verbose:   false,
		Logger:    posthogLogger,
	})

	if posthogErr != nil {
		panic(fmt.Sprintf("Error initializing Posthog client\n: %s", posthogErr))
	}

	var initialInstances []*InstanceInfo

	if env.IsProduction() {
		instances, instancesErr := nomadClient.GetInstances()
		if instancesErr != nil {
			fmt.Fprintf(os.Stderr, "Error loading current instances from Nomad\n: %v\n", instancesErr.Err)
		}

		initialInstances = instances
	} else {
		fmt.Println("Skipping loading instances from Nomad, running locally")
	}

	meter := otel.GetMeterProvider().Meter("nomad")

	instancesCounter, err := meter.Int64UpDownCounter(
		"api.env.instance.running",
		metric.WithDescription(
			"Number of running instances.",
		),
		metric.WithUnit("{instance}"),
	)
	if err != nil {
		panic(err)
	}

	analytics, err := analyticscollector.NewAnalytics()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing Analytics client\n: %v\n", err)
	}

	fmt.Println("Initialized Analytics client")

	instanceCache := nomad.NewInstanceCache(analytics.Client, getDeleteInstanceFunction(ctx, nomadClient, analytics, posthogClient), initialInstances, instancesCounter)

	fmt.Println("Initialized instance cache")

	if env.IsProduction() {
		go instanceCache.KeepInSync(nomadClient)
	} else {
		fmt.Println("Skipping syncing intances with Nomad, running locally")
	}

	storageClient, err := storage.NewClient(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing Cloud Storage client\n: %v\n", err)
		panic(err)
	}

	fmt.Println("Initialized Cloud Storage client")

	cStorage := &cloudStorage{
		bucket:  os.Getenv("GOOGLE_CLOUD_STORAGE_BUCKET"),
		client:  storageClient,
		context: ctx,
	}

	artifactRegistry, err := artifactregistry.NewClient(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing Artifact Registry client\n: %v\n", err)
		panic(err)
	}

	fmt.Println("Initialized Artifact Registry client")

	apiSecret := os.Getenv("API_SECRET")
	if apiSecret == "" {
		apiSecret = "SUPER_SECR3T_4PI_K3Y"
	}

	buildCounter, err := meter.Int64UpDownCounter(
		"api.env.build.running",
		metric.WithDescription(
			"Number of running builds.",
		),
		metric.WithUnit("{build}"),
	)
	if err != nil {
		panic(err)
	}

	buildCache := nomad.NewBuildCache(buildCounter)

	return &APIStore{
		Ctx:                        ctx,
		nomad:                      nomadClient,
		supabase:                   supabaseClient,
		instanceCache:              instanceCache,
		tracer:                     tracer,
		analytics:                  analytics,
		posthog:                    posthogClient,
		cloudStorage:               cStorage,
		artifactRegistry:           artifactRegistry,
		apiSecret:                  apiSecret,
		buildCache:                 buildCache,
		googleServiceAccountBase64: os.Getenv("GOOGLE_SERVICE_ACCOUNT_BASE64"),
	}
}

func (a *APIStore) Close() {
	a.nomad.Close()
	a.supabase.Close()

	err := a.analytics.Close()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error closing Analytics\n: %v\n", err)
	}

	err = a.posthog.Close()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error closing Posthog client\n: %v\n", err)
	}

	err = a.cloudStorage.client.Close()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error closing Cloud Storage client\n: %v\n", err)
	}

	err = a.artifactRegistry.Close()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error closing Artifact Registry client\n: %v\n", err)
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
		fmt.Fprintf(os.Stderr, "Error sending error: %v\n", err)
	}

	c.JSON(code, apiErr)
}

func (a *APIStore) GetHealth(c *gin.Context) {
	c.String(http.StatusOK, "Health check successful")
}

func (a *APIStore) GetTeamFromAPIKey(ctx context.Context, apiKey string) (models.Team, error) {
	team, err := a.supabase.GetTeamAuth(ctx, apiKey)
	if err != nil {
		return models.Team{}, fmt.Errorf("failed to get get team from db for api key: %w", err)
	}

	if team == nil {
		return models.Team{}, fmt.Errorf("failed to get a team from api key")
	}

	return *team, nil
}

func (a *APIStore) GetUserFromAccessToken(ctx context.Context, accessToken string) (uuid.UUID, error) {
	userID, err := a.supabase.GetUserID(ctx, accessToken)
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("failed to get get user from db for access token: %w", err)
	}

	if userID == nil {
		return uuid.UUID{}, fmt.Errorf("failed to get a user from access token")
	}

	return *userID, nil
}

func (a *APIStore) DeleteInstance(instanceID string, purge bool) *api.APIError {
	info, err := a.instanceCache.GetInstance(instanceID)
	if err != nil {
		return &api.APIError{
			Err:       err,
			ClientMsg: "Cannot delete the instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	return deleteInstance(a.Ctx, a.nomad, a.analytics, a.posthog, info, purge)
}

func (a *APIStore) CheckTeamAccessEnv(ctx context.Context, aliasOrEnvID string, teamID uuid.UUID, public bool) (env *api.Environment, hasAccess bool, err error) {
	return a.supabase.HasEnvAccess(ctx, aliasOrEnvID, teamID, public)
}

type InstanceInfo = nomad.InstanceInfo

func getDeleteInstanceFunction(ctx context.Context, nomad *nomad.NomadClient, analytics *analyticscollector.Analytics, posthogClient posthog.Client) func(info nomad.InstanceInfo, purge bool) *api.APIError {
	return func(info InstanceInfo, purge bool) *api.APIError {
		return deleteInstance(ctx, nomad, analytics, posthogClient, info, purge)
	}
}

func deleteInstance(
	ctx context.Context,
	nomad *nomad.NomadClient,
	analytics *analyticscollector.Analytics,
	posthogClient posthog.Client,
	info InstanceInfo,
	purge bool,
) *api.APIError {
	duration := time.Since(*info.StartTime).Seconds()

	delErr := nomad.DeleteInstance(info.Instance.SandboxID, purge)
	if delErr != nil {
		errMsg := fmt.Errorf("cannot delete instance '%s': %w", info.Instance.SandboxID, delErr.Err)

		return &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot delete the instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	if info.TeamID != nil && info.StartTime != nil {
		_, err := analytics.Client.InstanceStopped(ctx, &analyticscollector.InstanceStoppedEvent{
			TeamId:        info.TeamID.String(),
			EnvironmentId: info.Instance.TemplateID,
			InstanceId:    info.Instance.SandboxID,
			Timestamp:     timestamppb.Now(),
			Duration:      float32(duration),
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "error sending Analytics event: %v\n", err)
		}

		CreateAnalyticsTeamEvent(
			posthogClient,
			info.TeamID.String(),
			"closed_instance", posthog.NewProperties().
				Set("instance_id", info.Instance.SandboxID).
				Set("environment", info.Instance.TemplateID).
				Set("duration", duration),
		)
	}

	return nil
}

func (a *APIStore) GetPackageToPosthogProperties(header *http.Header) posthog.Properties {
	properties := posthog.NewProperties().
		Set("browser", header.Get("browser")).
		Set("lang", header.Get("lang")).
		Set("lang_version", header.Get("lang_version")).
		Set("machine", header.Get("machine")).
		Set("os", header.Get("os")).
		Set("package_version", header.Get("package_version")).
		Set("processor", header.Get("processor")).
		Set("publisher", header.Get("publisher")).
		Set("release", header.Get("release")).
		Set("sdk_runtime", header.Get("sdk_runtime")).
		Set("system", header.Get("system"))

	return properties
}
