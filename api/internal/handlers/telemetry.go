package handlers

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

	fmt.Println(name, attrs)

	span.AddEvent(name,
		trace.WithAttributes(attrs...),
	)
}

func ReportCriticalError(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)

	fmt.Fprint(os.Stderr, err.Error())

	span.RecordError(err,
		trace.WithStackTrace(true),
	)
	span.SetStatus(codes.Error, "critical error")
}

func ReportError(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)

	fmt.Fprint(os.Stderr, err.Error())

	span.RecordError(err,
		trace.WithStackTrace(true),
	)
}
