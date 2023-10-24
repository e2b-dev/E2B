package main

import (
	"flag"
	"net/http"
	_ "net/http/pprof"
	"time"

	log "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins"
	"github.com/lightstep/otel-launcher-go/launcher"

	driver "github.com/e2b-dev/infra/packages/env-build-task-driver/internal"
	env "github.com/e2b-dev/infra/packages/env-build-task-driver/internal/env"
)

const (
	otelCollectorGRPCEndpoint = "0.0.0.0:4317"
	profilingPort             = ":6062"
)

func factory(log log.Logger) interface{} {
	return driver.NewPlugin(log)
}

func main() {
	// Create pprof endpoint for profiling
	go func() {
		http.ListenAndServe(profilingPort, nil)
	}()

	envID := flag.String("env", "", "env id")
	buildID := flag.String("build", "", "build id")

	flag.Parse()

	if *envID != "" && *buildID != "" {
		// Start of mock build for testing
		env.MockBuild(*envID, *buildID)
	} else {
		// Regular Nomad Plugin initialization
		otelLauncher := launcher.ConfigureOpentelemetry(
			launcher.WithServiceName(driver.PluginName),
			launcher.WithServiceVersion(driver.PluginVersion),
			launcher.WithMetricReportingPeriod(10*time.Second),
			launcher.WithSpanExporterEndpoint(otelCollectorGRPCEndpoint),
			launcher.WithMetricExporterEndpoint(otelCollectorGRPCEndpoint),
			launcher.WithMetricExporterInsecure(true),
			launcher.WithPropagators([]string{"tracecontext", "baggage"}),
			launcher.WithSpanExporterInsecure(true),
		)
		defer otelLauncher.Shutdown()

		plugins.Serve(factory)
	}
}
