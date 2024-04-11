package metrics

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

// Recorder knows how to record and measure the metrics. This
// has the required methods to be used with the HTTP
// middlewares.
type otelRecorder struct {
	totalDuration metric.Float64Histogram
}

func GetRecorder(metricsPrefix string) Recorder {
	metricName := func(metricName string) string {
		if len(metricsPrefix) > 0 {
			return metricsPrefix + "." + metricName
		}

		return metricName
	}

	meter := otel.Meter("api-metrics", metric.WithInstrumentationVersion(SemVersion()))

	totalDuration, _ := meter.Float64Histogram(
		metricName("http.server.test.request_duration_4"),
		metric.WithDescription("Time Taken by request"),
		metric.WithUnit("s"),
	)

	return &otelRecorder{
		totalDuration: totalDuration,
	}
}

// ObserveHTTPRequestDuration measures the duration of an HTTP request.
func (r *otelRecorder) ObserveHTTPRequestDuration(ctx context.Context, duration time.Duration, attributes []attribute.KeyValue) {
	r.totalDuration.Record(ctx, float64(duration/time.Second), metric.WithAttributes(attributes...))
}
