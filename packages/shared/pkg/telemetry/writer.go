package telemetry

import (
	"context"
	"fmt"
	"io"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type EventWriter struct {
	span trace.Span
	name string
}

func (w *EventWriter) Write(p []byte) (n int, err error) {
	fmt.Printf("->> [%s] %s\n", w.name, strings.Trim(string(p), " \t\n"))

	w.span.AddEvent(w.name,
		trace.WithAttributes(
			attribute.String("content", string(p)),
		),
	)

	return len(p), nil
}

func NewEventWriter(ctx context.Context, name string) io.Writer {
	span := trace.SpanFromContext(ctx)

	return &EventWriter{
		name: name,
		span: span,
	}
}
