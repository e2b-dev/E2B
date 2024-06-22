package logs

import (
	"context"
	"io"
	"os"
	"time"

	"github.com/e2b-dev/infra/packages/envd/internal/logs/exporter"

	"github.com/rs/zerolog"
)

func NewLogger(ctx context.Context, debug bool) *zerolog.Logger {
	zerolog.TimestampFieldName = "timestamp"
	zerolog.TimeFieldFormat = time.RFC3339Nano

	exporters := []io.Writer{}

	if debug {
		exporters = append(exporters, os.Stdout)
	} else {
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
