package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/api"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/handlers"
	"github.com/e2b-dev/infra/packages/shared/pkg/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

const (
	serviceName          = "orchestrator" // 256 MiB
	maxReadHeaderTimeout = 60 * time.Second
	defaultPort          = 5008
)

func NewGinServer(apiStore *handlers.APIStore, swagger *openapi3.T, port int) *http.Server {
	// Clear out the servers array in the swagger spec, that skips validating
	// that server names match. We don't know how this thing will be run.
	swagger.Servers = nil

	r := gin.New()

	r.Use(
		gin.Recovery(),
		gin.LoggerWithWriter(gin.DefaultWriter),
	)

	config := cors.DefaultConfig()
	// Allow all origins
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{
		// Default headers
		"Origin",
		"Content-Length",
		"Content-Type",
		// API Key header
		"Authorization",
		"X-API-Key",
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

	// We now register our store above as the handler for the interface
	api.RegisterHandlers(r, apiStore)

	s := &http.Server{
		Handler:           r,
		Addr:              fmt.Sprintf("0.0.0.0:%d", port),
		ReadHeaderTimeout: maxReadHeaderTimeout,
	}

	return s
}

func main() {
	fmt.Println("Initializing...")

	port := flag.Int("port", defaultPort, "Port for test HTTP server")
	flag.Parse()

	debug := flag.String("true", "false", "is debug")

	if *debug != "true" {
		gin.SetMode(gin.ReleaseMode)
	}

	swagger, err := api.GetSwagger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading swagger spec\n: %v\n", err)
		os.Exit(1)
	}

	if env.IsProduction() {
		shutdown := telemetry.InitOTLPExporter(serviceName, swagger.Info.Version)
		defer shutdown()
	}

	// Create an instance of our handler which satisfies the generated interface
	apiStore := handlers.NewAPIStore()
	defer apiStore.Close()

	s := NewGinServer(apiStore, swagger, *port)

	fmt.Printf("Starting server on port %d\n", *port)
	// And we serve HTTP until the world ends.
	err = s.ListenAndServe()
	if err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
	}
}
