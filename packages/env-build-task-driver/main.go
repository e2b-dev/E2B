package main

import (
	"flag"
	"net/http"
	"time"

	log "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins"

	driver "github.com/e2b-dev/api/packages/env-build-task-driver/internal"

	_ "net/http/pprof"

	"github.com/lightstep/otel-launcher-go/launcher"
)

const (
	serviceName               = "env-build-task-driver"
	otelCollectorGRPCEndpoint = "0.0.0.0:4317"
)

func configurePlugin() {
	otelLauncher := launcher.ConfigureOpentelemetry(
		launcher.WithServiceName(serviceName),
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

func factory(log log.Logger) interface{} {
	return driver.NewPlugin(log)
}

func main() {
	// Create pprof endpoint for profiling
	go func() {
		http.ListenAndServe(":6062", nil)
	}()

	testMode := flag.Bool("test", false, "run in testing mode")
	flag.Parse()

	if *testMode {
		configurePlugin()
	} else {
		driver.TestBuildProcess()
	}
}
