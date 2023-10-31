package telemetry

import (
	"time"

	"github.com/lightstep/otel-launcher-go/launcher"
)

const (
	otelCollectorGRPCEndpoint = "0.0.0.0:4317"
	metricExportPeriod        = 15 * time.Second
)

// InitOTLPExporter initializes an OTLP exporter, and configures the corresponding trace providers.
func InitOTLPExporter(serviceName, serviceVersion string) func() {
	otelLauncher := launcher.ConfigureOpentelemetry(
		launcher.WithServiceName(serviceName),
		launcher.WithMetricReportingPeriod(metricExportPeriod),
		launcher.WithSpanExporterEndpoint(otelCollectorGRPCEndpoint),
		launcher.WithMetricExporterEndpoint(otelCollectorGRPCEndpoint),
		launcher.WithMetricExporterInsecure(true),
		launcher.WithSpanExporterInsecure(true),
		launcher.WithPropagators([]string{"tracecontext", "baggage"}),
	)

	return func() {
		otelLauncher.Shutdown()
	}
}
