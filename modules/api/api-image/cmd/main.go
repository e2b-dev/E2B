package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/devbookhq/orchestration-services/modules/api/api-image/internal/handlers"
	"github.com/devbookhq/orchestration-services/modules/api/api-image/pkg/nomad"

	middleware "github.com/deepmap/oapi-codegen/pkg/gin-middleware"
	"github.com/gin-gonic/gin"
)

func NewGinServer(apiStore *APIStore, port int) *http.Server {
	swagger, err := handlers.GetSwagger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading swagger spec\n: %s", err)
		os.Exit(1)
	}

	// Clear out the servers array in the swagger spec, that skips validating
	// that server names match. We don't know how this thing will be run.
	swagger.Servers = nil

	// This is how you set up a basic gin router
	r := gin.Default()

	// Use our validation middleware to check all requests against the
	// OpenAPI schema.
	r.Use(middleware.OapiRequestValidator(swagger))

	// We now register our store above as the handler for the interface
	r = handlers.RegisterHandlers(r, apiStore)

	s := &http.Server{
		Handler: r,
		Addr:    fmt.Sprintf("0.0.0.0:%d", port),
	}
	return s
}

func main() {
	var port = flag.Int("port", 80, "Port for test HTTP server")
	flag.Parse()
	// Create an instance of our handler which satisfies the generated interface

	nomad := nomad.InitNomad()
	apiStore := NewAPIStore(nomad)

	s := NewGinServer(apiStore, *port)
	// And we serve HTTP until the world ends.
	log.Fatal(s.ListenAndServe())
}
