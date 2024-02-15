package telemetry

import (
	"context"
	"fmt"
	"os"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var OTELTracingPrint = os.Getenv("OTEL_TRACING_PRINT") != "false"

func SetAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)

	if OTELTracingPrint {
		fmt.Printf("It's on - OTELTracingPrint: %s", os.Getenv("OTEL_TRACING_PRINT"))
		if len(attrs) == 0 {
			fmt.Printf("No attrs set")
		} else {
			fmt.Printf("Attrs set: %v\n", attrs)
		}
	}

	span.SetAttributes(attrs...)
}

func ReportEvent(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)

	if OTELTracingPrint {
		if len(attrs) == 0 {
			fmt.Printf("-> %s\n", name)
		} else {
			fmt.Printf("-> %s - %v\n", name, attrs)
		}
	}

	span.AddEvent(name,
		trace.WithAttributes(attrs...),
	)
}

func ReportCriticalError(ctx context.Context, err error, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)

	if OTELTracingPrint {
		fmt.Printf("It's on - OTELTracingPrint: %s", os.Getenv("OTEL_TRACING_PRINT"))

		if len(attrs) == 0 {
			fmt.Fprintf(os.Stderr, "Critical error: %v\n", err)
		} else {
			fmt.Fprintf(os.Stderr, "Critical error: %v - %v\n", err, attrs)
		}
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

	if OTELTracingPrint {
		fmt.Printf("It's on - OTELTracingPrint: %s", os.Getenv("OTEL_TRACING_PRINT"))
		if len(attrs) == 0 {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		} else {
			fmt.Fprintf(os.Stderr, "Error: %v - %v\n", err, attrs)
		}
	}

	span.RecordError(err,
		trace.WithStackTrace(true),
		trace.WithAttributes(
			attrs...,
		),
	)
}

func GetContextFromRemote(ctx context.Context, tracer trace.Tracer, name, spanID, traceID string) (context.Context, trace.Span) {
	tid, traceIDErr := trace.TraceIDFromHex(traceID)
	if traceIDErr != nil {
		ReportError(
			ctx,
			traceIDErr,
			attribute.String("trace.id", traceID),
			attribute.Int("trace.id.length", len(traceID)),
		)
	}

	sid, spanIDErr := trace.SpanIDFromHex(spanID)
	if spanIDErr != nil {
		ReportError(
			ctx,
			spanIDErr,
			attribute.String("span.id", spanID),
			attribute.Int("span.id.length", len(spanID)),
		)
	}

	remoteCtx := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    tid,
		SpanID:     sid,
		TraceFlags: 0x0,
	})

	return tracer.Start(
		trace.ContextWithRemoteSpanContext(ctx, remoteCtx),
		name,
		trace.WithLinks(
			trace.LinkFromContext(ctx, attribute.String("link", "validation")),
		),
	)
}
