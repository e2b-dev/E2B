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
		hook.span.SetStatus(codes.Error, "critical error")
		hook.span.RecordError(fmt.Errorf(entry.Message))
	case log.WarnLevel:
		hook.span.RecordError(fmt.Errorf(entry.Message))
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

func ReportError(ctx context.Context, err error, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)

	fmt.Fprint(os.Stderr, err.Error())

	span.RecordError(err,
		trace.WithStackTrace(true),
		trace.WithAttributes(
			attrs...,
		),
	)
}
