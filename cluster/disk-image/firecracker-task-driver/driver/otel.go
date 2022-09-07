package firevm

import (
	"fmt"

	log "github.com/sirupsen/logrus"
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
