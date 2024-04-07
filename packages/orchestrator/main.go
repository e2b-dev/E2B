package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/api"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/handlers"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/instance"
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

func test() bool {
	envID := flag.String("env", "", "env id")
	instanceID := flag.String("instance", "", "instance id")
	keepAlive := flag.Int("alive", 0, "keep alive")
	count := flag.Int("count", 1, "number of spawned instances")

	flag.Parse()

	if *envID != "" && *instanceID != "" {
		// Start of mock build for testing
		consulToken := os.Getenv("CONSUL_TOKEN")

		dns, err := instance.NewDNS()
		if err != nil {
			panic(err)
		}

		groupSize := 2

		for i := 0; i < *count; i++ {
			func(in int, envID, instanceID string, count int) {
				var wg sync.WaitGroup

				for j := 0; j < groupSize; j++ {
					wg.Add(1)

					go func(jn int) {
						defer wg.Done()
						id := fmt.Sprintf("%s_%d", instanceID, in+jn*count)
						fmt.Printf("\nSTARTING [%s]\n\n", id)
						instance.MockInstance(envID, id, consulToken, dns, time.Duration(*keepAlive)*time.Second)
					}(j)
				}

				wg.Wait()
			}(i, *envID, *instanceID, *count)
		}
	} else {
		return false
	}

	return true
}


func main() {
	if test() {
		return
	}

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
