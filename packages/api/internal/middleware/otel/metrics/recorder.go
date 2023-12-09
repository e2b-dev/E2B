package metrics

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"
)

type Recorder interface {
	// AddRequests increments the number of requests being processed.
	AddRequests(ctx context.Context, quantity int64, attributes []attribute.KeyValue)

	// ObserveHTTPRequestDuration measures the duration of an HTTP request.
	ObserveHTTPRequestDuration(ctx context.Context, duration time.Duration, attributes []attribute.KeyValue)

	// // ObserveHTTPRequestSize measures the size of an HTTP request in bytes.
	// ObserveHTTPRequestSize(ctx context.Context, sizeBytes int64, attributes []attribute.KeyValue)

	// // ObserveHTTPResponseSize measures the size of an HTTP response in bytes.
	// ObserveHTTPResponseSize(ctx context.Context, sizeBytes int64, attributes []attribute.KeyValue)

	// AddInflightRequests increments and decrements the number of inflight request being processed.
	AddInflightRequests(ctx context.Context, quantity int64, attributes []attribute.KeyValue)
}
