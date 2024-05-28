package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"

	connectFS "github.com/e2b-dev/infra/packages/envd/internal/services/filesystem"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/e2b-dev/infra/packages/envd/internal/api"
	"github.com/getkin/kin-openapi/openapi3"
)

const (
	maxTimeout  = 0
	defaultPort = 80
)

var (
	defaultLogDir    = filepath.Join("/var", "log")
	defaultGatewayIP = net.IPv4(169, 254, 0, 21)
)


func NewGinServer(apiStore *handlers.APIStore, swagger *openapi3.T, port int) *http.Server {
	// Clear out the servers array in the swagger spec, that skips validating
	// that server names match. We don't know how this thing will be run.
	swagger.Servers = nil

	r := gin.New()

	r.Use(
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
		// API Key header
		"Authorization",
		"X-API-Key",
		// Custom headers sent from SDK
	}
	r.Use(cors.New(config))

	// We now register our store above as the handler for the interface
	api.RegisterHandlers(r, apiStore)

	connectFS.Handle(r)

	mux := http.NewServeMux()

	connectFS.Handle(mux)

	r.Handle(http.MethodGet, "/")

	s := &http.Server{
		Handler:           r,
		Addr:              fmt.Sprintf("0.0.0.0:%d", port),
		ReadHeaderTimeout: maxTimeout,
		ReadTimeout:       maxTimeout,
		WriteTimeout:      maxTimeout,
		IdleTimeout:       maxTimeout,
	}

	return s
}

func main() {
	l, err := log.NewLogger(defaultLogDir, debug, true)
	if err != nil {
		return nil, nil, fmt.Errorf("error creating a new logger: %w", err)



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

	// create a type that satisfies the `api.ServerInterface`, which contains an implementation of every operation from the generated code
	server := api.NewAPI()

	r := http.NewServeMux()

	// get an `http.Handler` that we can use
	h := api.HandlerFromMux(server, r)

	s := &http.Server{
		Handler:           h,
		Addr:              fmt.Sprintf("0.0.0.0:%d", port),
		ReadHeaderTimeout: maxTimeout,
		ReadTimeout:       maxTimeout,
		WriteTimeout:      maxTimeout,
		IdleTimeout:       maxTimeout,
	}

	// And we serve HTTP until the world ends.
	log.Fatal(s.ListenAndServe())
}
