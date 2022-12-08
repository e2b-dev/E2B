package main

import (
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/devbookhq/devbook-api/packages/api/internal/api"
	"github.com/devbookhq/devbook-api/packages/api/internal/handlers"
	customMiddleware "github.com/devbookhq/devbook-api/packages/api/internal/middleware"
	"github.com/gin-contrib/cors"

	middleware "github.com/deepmap/oapi-codegen/pkg/gin-middleware"
	"github.com/gin-gonic/gin"

	"github.com/lightstep/otel-launcher-go/launcher"
)

var (
	ignoreLoggingForPaths     = []string{"/health"}
	serviceName               = "orchestration-api"
	otelCollectorGRPCEndpoint = "0.0.0.0:4317"
)

func NewGinServer(apiStore *handlers.APIStore, port int) *http.Server {
	swagger, err := api.GetSwagger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading swagger spec\n: %s", err)
		os.Exit(1)
	}

	// Clear out the servers array in the swagger spec, that skips validating
	// that server names match. We don't know how this thing will be run.
	swagger.Servers = nil

	r := gin.New()

	// We use custom otelgin middleware because we want to log 4xx errors in the otel
	otelMiddleware := customMiddleware.ExcludeRoutes(customMiddleware.Otel(serviceName), ignoreLoggingForPaths...)
	r.Use(
		otelMiddleware,
		gin.LoggerWithWriter(gin.DefaultWriter, ignoreLoggingForPaths...),
		gin.Recovery(),
	)

	// Allow all origins
	r.Use(cors.Default())

	// Use our validation middleware to check all requests against the
	// OpenAPI schema.
	r.Use(middleware.OapiRequestValidator(swagger))

	// We now register our store above as the handler for the interface
	r = api.RegisterHandlers(r, apiStore)

	s := &http.Server{
		Handler: r,
		Addr:    fmt.Sprintf("0.0.0.0:%d", port),
	}
	return s
}

func main() {
	fmt.Println("Initializing...")

	telemetryAPIKey := flag.String("telemetry-api", "", "api key for telemetry")
	port := flag.Int("port", 80, "Port for test HTTP server")
	flag.Parse()

	rand.Seed(time.Now().UnixNano())

	if *telemetryAPIKey == "" {
		// otelLauncher := launcher.ConfigureOpentelemetry(
		// 	launcher.WithServiceName(serviceName),
		// 	launcher.WithMetricReportingPeriod(10*time.Second),
		// 	launcher.WithSpanExporterEndpoint(otelCollectorGRPCEndpoint),
		// 	launcher.WithMetricExporterEndpoint(otelCollectorGRPCEndpoint),
		// 	launcher.WithMetricExporterInsecure(true),
		// 	launcher.WithSpanExporterInsecure(true),
		// 	launcher.WithPropagators([]string{"tracecontext", "baggage"}),
		// )
		// defer otelLauncher.Shutdown()
	} else {
		otelLauncher := launcher.ConfigureOpentelemetry(
			launcher.WithServiceName(serviceName),
			launcher.WithAccessToken(*telemetryAPIKey),
		)
		defer otelLauncher.Shutdown()
	}

	// Create an instance of our handler which satisfies the generated interface
	apiStore := handlers.NewAPIStore()
	defer apiStore.Close()

	s := NewGinServer(apiStore, *port)
	// And we serve HTTP until the world ends.
	log.Fatal(s.ListenAndServe())
}
