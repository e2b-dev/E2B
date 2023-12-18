package metrics

import (
	"context"
	"math"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

// Recorder knows how to record and measure the metrics. This
// has the required methods to be used with the HTTP
// middlewares.
type otelRecorder struct {
	attemptsCounter       metric.Int64UpDownCounter
	totalDuration         metric.Int64Histogram
	activeRequestsCounter metric.Int64UpDownCounter
	requestSize           metric.Int64Histogram
	responseSize          metric.Int64Histogram
}

func GetRecorder(metricsPrefix string) Recorder {
	metricName := func(metricName string) string {
		if len(metricsPrefix) > 0 {
			return metricsPrefix + "." + metricName
		}

		return metricName
	}

	meter := otel.Meter("api-metrics", metric.WithInstrumentationVersion(SemVersion()))
	attemptsCounter, _ := meter.Int64UpDownCounter(
		metricName("http.server.request_count"),
		metric.WithDescription("Number of Requests"),
		metric.WithUnit("Count"),
	)

	totalDuration, _ := meter.Int64Histogram(
		metricName("http.server.test.request_duration_test_1"),
		metric.WithDescription("Time Taken by request"),
		metric.WithUnit("ms"),
		metric.WithExplicitBucketBoundaries(
			0,
			64,
			128,
			256,
			512,
			1024,
			2048,
			4096,
			8192,
			math.Inf(1),
		),
	)

	activeRequestsCounter, _ := meter.Int64UpDownCounter(
		metricName("http.server.active_requests"),
		metric.WithDescription("Number of requests inflight"),
		metric.WithUnit("Count"),
	)

	requestSize, _ := meter.Int64Histogram(
		metricName("http.server.request_content_length"),
		metric.WithDescription("Request Size"),
		metric.WithUnit("Bytes"),
	)

	responseSize, _ := meter.Int64Histogram(
		metricName("http.server.response_content_length"),
		metric.WithDescription("Response Size"),
		metric.WithUnit("Bytes"),
	)

	return &otelRecorder{
		attemptsCounter:       attemptsCounter,
		totalDuration:         totalDuration,
		activeRequestsCounter: activeRequestsCounter,
		requestSize:           requestSize,
		responseSize:          responseSize,
	}
}

// AddRequests increments the number of requests being processed.
func (r *otelRecorder) AddRequests(ctx context.Context, quantity int64, attributes []attribute.KeyValue) {
	r.attemptsCounter.Add(ctx, quantity, metric.WithAttributes(attributes...))
}

// ObserveHTTPRequestDuration measures the duration of an HTTP request.
func (r *otelRecorder) ObserveHTTPRequestDuration(ctx context.Context, duration time.Duration, attributes []attribute.KeyValue) {
	r.totalDuration.Record(ctx, int64(duration/time.Millisecond), metric.WithAttributes(attributes...))
}

// // ObserveHTTPRequestSize measures the size of an HTTP request in bytes.
func (r *otelRecorder) ObserveHTTPRequestSize(ctx context.Context, sizeBytes int64, attributes []attribute.KeyValue) {
	r.requestSize.Record(ctx, sizeBytes, metric.WithAttributes(attributes...))
}

// // ObserveHTTPResponseSize measures the size of an HTTP response in bytes.
func (r *otelRecorder) ObserveHTTPResponseSize(ctx context.Context, sizeBytes int64, attributes []attribute.KeyValue) {
	r.responseSize.Record(ctx, sizeBytes, metric.WithAttributes(attributes...))
}

// AddInflightRequests increments and decrements the number of inflight request being processed.
func (r *otelRecorder) AddInflightRequests(ctx context.Context, quantity int64, attributes []attribute.KeyValue) {
	r.activeRequestsCounter.Add(ctx, quantity, metric.WithAttributes(attributes...))
}
