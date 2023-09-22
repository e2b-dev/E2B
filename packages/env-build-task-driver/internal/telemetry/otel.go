package telemetry

import (
	"context"
	"fmt"
	"os"

	log "github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type OtelHook struct {
	span trace.Span
}

func (hook *OtelHook) Fire(entry *log.Entry) error {
	switch entry.Level {
	case log.ErrorLevel:
	case log.FatalLevel:
	case log.PanicLevel:
		hook.span.SetStatus(codes.Error, "critical error")
		hook.span.RecordError(fmt.Errorf(entry.Message))
	case log.WarnLevel:
		hook.span.RecordError(fmt.Errorf(entry.Message))
	case log.InfoLevel:
	case log.DebugLevel:
	case log.TraceLevel:
	default:
		hook.span.AddEvent(entry.Message)
	}

	return nil
}

var supportedLevels = []log.Level{log.DebugLevel, log.InfoLevel, log.WarnLevel, log.ErrorLevel}

func (hook *OtelHook) Levels() []log.Level {
	return supportedLevels
}

func NewOtelHook(span trace.Span) *OtelHook {
	return &OtelHook{
		span: span,
	}
}

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
