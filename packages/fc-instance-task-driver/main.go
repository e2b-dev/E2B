package main

import (
	"flag"
	"time"

	driver "github.com/e2b-dev/api/packages/fc-instance-task-driver/internal"
	log "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins"

	"net/http"

	_ "net/http/pprof"

	"github.com/lightstep/otel-launcher-go/launcher"
)

const (
	serviceName               = "fc-instance-task-driver"
	otelCollectorGRPCEndpoint = "0.0.0.0:4317"
)

func main() {
	// Create pprof endpoint for profiling
	go func() {
		http.ListenAndServe(":6061", nil)
	}()

	telemetryAPIKey := flag.String("telemetry-api", "", "api key for telemetry")
	flag.Parse()

	if *telemetryAPIKey == "" {
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
	} else {
		otelLauncher := launcher.ConfigureOpentelemetry(
			launcher.WithServiceName(serviceName),
			launcher.WithAccessToken(*telemetryAPIKey),
		)
		defer otelLauncher.Shutdown()
	}

	plugins.Serve(factory)
}

func factory(log log.Logger) interface{} {
	return driver.NewFirecrackerDriver(log)
}
