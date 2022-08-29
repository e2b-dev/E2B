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
	"github.com/lightstep/otel-launcher-go/launcher"

	"github.com/devbookhq/orchestration-services/api/internal/api"
	"github.com/devbookhq/orchestration-services/api/internal/handlers"

	middleware "github.com/deepmap/oapi-codegen/pkg/gin-middleware"
	"github.com/gin-gonic/gin"
)

var ignoreLoggingForPaths = []string{"/health"}

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
	r.Use(
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
	// Telemetry setup

	ctx := context.Background()

	// Configure a new exporter using environment variables for sending data to Honeycomb over gRPC.
	exporter, err := otlptracegrpc.New(ctx)
	if err != nil {
		log.Fatalf("failed to initialize exporter: %v", err)
	}

	// Create a new tracer provider with a batch span processor and the otlp exporter.
	tp := trace.NewTracerProvider(
		trace.WithBatcher(exporter),
	)

	// Handle shutdown errors in a sensible manner where possible
	defer func() { _ = tp.Shutdown(ctx) }()

	// Set the Tracer Provider global
	otel.SetTracerProvider(tp)

	// Register the trace context and baggage propagators so data is propagated across services/processes.
	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)

	// Implement an HTTP Handler func to be instrumented
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello, World")
	})

	// Initialize HTTP handler instrumentation
	otelHandler := otelhttp.NewHandler(handler, "hello")
	http.Handle("/hello", otelHandler)

	// Run web server
	log.Fatal(http.ListenAndServe(":8000", nil))

	otelLauncher := launcher.ConfigureOpentelemetry(
		launcher.WithServiceName("service-123"),
		launcher.WithAccessToken("ZalSXzlSX3N89FVEX6wT2JR7Zd2GBo9bv9ewUddPmA8XYWxUFBIGqKSUFUV9xAMlFtmwfLOd4y3DT9GNZ08NGbmQaOqqLKGg/krQ9JkX"),
	)
	defer otelLauncher.Shutdown()

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
