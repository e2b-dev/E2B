package telemetry

import (
	"context"
	"fmt"
	"os"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

func ReportEvent(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)

	if len(attrs) == 0 {
		fmt.Printf("-> %s\n", name)
	} else {
		fmt.Printf("-> %s - %v\n", name, attrs)
	}

	span.AddEvent(name,
		trace.WithAttributes(attrs...),
	)
}

func ReportCriticalError(ctx context.Context, err error, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)

	if len(attrs) == 0 {
		fmt.Fprintf(os.Stderr, "Critical error: %v\n", err)
	} else {
		fmt.Fprintf(os.Stderr, "Critical error: %v - %v\n", err, attrs)
	}

	span.RecordError(err,
		trace.WithStackTrace(true),
		trace.WithAttributes(
			attrs...,
		),
	)

	span.SetStatus(codes.Error, "critical error")
}

func ReportError(ctx context.Context, err error, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)

	if len(attrs) == 0 {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
	} else {
		fmt.Fprintf(os.Stderr, "Error: %v - %v\n", err, attrs)
	}

	span.RecordError(err,
		trace.WithStackTrace(true),
		trace.WithAttributes(
			attrs...,
		),
	)
}
