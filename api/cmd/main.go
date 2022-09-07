package main

import (
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"

	"github.com/devbookhq/orchestration-services/api/internal/api"
	"github.com/devbookhq/orchestration-services/api/internal/handlers"
	middlewareWrapper "github.com/devbookhq/orchestration-services/api/internal/middleware"

	middleware "github.com/deepmap/oapi-codegen/pkg/gin-middleware"
	"github.com/gin-gonic/gin"

	"github.com/lightstep/otel-launcher-go/launcher"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

var (
	tracer                trace.Tracer
	ignoreLoggingForPaths = []string{"/health"}
	serviceName           = "orchestration-api"
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

	otelMiddleware := middlewareWrapper.ExcludeRoutes(otelgin.Middleware(serviceName), ignoreLoggingForPaths...)
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
	otelLauncher := launcher.ConfigureOpentelemetry(
		launcher.WithServiceName(serviceName),
		launcher.WithMetricReportingPeriod(10*time.Second),
		launcher.WithSpanExporterEndpoint("http://localhost:4318"),
		launcher.WithMetricExporterEndpoint("http://localhost:4318"),
		// launcher.WithLogger(serviceName),
		// launcher.WithAccessToken(os.Getenv("LIGHTSTEP_API_KEY")),
	)
	defer otelLauncher.Shutdown()

	tracer = otel.Tracer(serviceName)

	rand.Seed(time.Now().UnixNano())

	var port = flag.Int("port", 80, "Port for test HTTP server")
	flag.Parse()
	// Create an instance of our handler which satisfies the generated interface

	apiStore := handlers.NewAPIStore()
	defer apiStore.Close()

	s := NewGinServer(apiStore, *port)
	// And we serve HTTP until the world ends.
	log.Fatal(s.ListenAndServe())
}
