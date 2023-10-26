package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	middleware "github.com/deepmap/oapi-codegen/pkg/gin-middleware"
	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/handlers"
	customMiddleware "github.com/e2b-dev/infra/packages/api/internal/middleware"
	"github.com/e2b-dev/infra/packages/shared/utils"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/pprof"
	"github.com/gin-gonic/gin"
)

const (
	serviceName = "orchestration-api"
)

var ignoreLoggingForPaths = []string{"/health"}

func NewGinServer(apiStore *handlers.APIStore, swagger *openapi3.T, port int) *http.Server {
	// Clear out the servers array in the swagger spec, that skips validating
	// that server names match. We don't know how this thing will be run.
	swagger.Servers = nil

	r := gin.New()

	pprof.Register(r, "debug/pprof")

	// We use custom otelgin middleware because we want to log 4xx errors in the utils
	otelMiddleware := customMiddleware.ExcludeRoutes(
		customMiddleware.Otel(serviceName),
		ignoreLoggingForPaths...,
	)
	r.Use(
		otelMiddleware,
		gin.LoggerWithWriter(gin.DefaultWriter, ignoreLoggingForPaths...),
		gin.Recovery(),
	)

	config := cors.DefaultConfig()
	// Allow all origins
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{
		// Default headers
		"Origin",
		"Content-Length",
		"Content-Type",
		// Custom headers sent from SDK
		"browser",
		"lang",
		"lang_version",
		"machine",
		"os",
		"package_version",
		"processor",
		"publisher",
		"release",
		"sdk_runtime",
		"system",
	}
	r.Use(cors.New(config))

	// Create a team API Key auth validator
	AuthenticationFunc := customMiddleware.CreateAuthenticationFunc(
		apiStore.GetTeamFromAPIKey,
		apiStore.GetUserFromAccessToken,
	)

	// Use our validation middleware to check all requests against the
	// OpenAPI schema.
	r.Use(middleware.OapiRequestValidatorWithOptions(swagger,
		&middleware.Options{
			Options: openapi3filter.Options{
				AuthenticationFunc: AuthenticationFunc,
			},
		}))

	// We now register our store above as the handler for the interface
	api.RegisterHandlers(r, apiStore)

	s := &http.Server{
		Handler: r,
		Addr:    fmt.Sprintf("0.0.0.0:%d", port),
	}

	return s
}

func main() {
	fmt.Println("Initializing...")

	port := flag.Int("port", 80, "Port for test HTTP server")
	flag.Parse()

	debug := flag.String("true", "false", "is debug")

	if *debug != "true" {
		gin.SetMode(gin.ReleaseMode)
	}

	swagger, err := api.GetSwagger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading swagger spec\n: %s", err)
		os.Exit(1)
	}

	shutdown, err := utils.InitOTLPExporter(serviceName, swagger.Info.Version)
	if err != nil {
		log.Fatalf("failed to initialize OTLP exporter: %v", err)
	}
	defer shutdown()

	// Create an instance of our handler which satisfies the generated interface
	apiStore := handlers.NewAPIStore()
	defer apiStore.Close()

	s := NewGinServer(apiStore, swagger, *port)

	// And we serve HTTP until the world ends.
	log.Fatal(s.ListenAndServe())
}
