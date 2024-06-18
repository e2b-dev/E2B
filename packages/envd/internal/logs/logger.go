package logs

import (
	"context"
	"io"
	"os"

	"github.com/e2b-dev/infra/packages/envd/internal/logs/exporter"

	"github.com/rs/zerolog"
)

func NewLogger(ctx context.Context, debug bool) *zerolog.Logger {
	zerolog.TimestampFieldName = "timestamp"

	exporters := []io.Writer{
		os.Stdout,
	}

	if !debug {
		exporters = append(exporters, exporter.NewHTTPLogsExporter(ctx, false))
	}

	l := zerolog.
		New(io.MultiWriter(exporters...)).
		With().
		Timestamp().
		Logger().
		Level(zerolog.DebugLevel)

	return &l
}
