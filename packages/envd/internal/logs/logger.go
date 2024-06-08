package logs

import (
	"context"
	"io"
	"os"

	"github.com/e2b-dev/infra/packages/envd/internal/logs/exporter"

	"github.com/rs/zerolog"
)

func NewLogger(ctx context.Context, debug bool) *zerolog.Logger {
	var w io.Writer
	if debug {
		w = os.Stdout
	} else {
		w = exporter.NewHTTPLogsExporter(ctx, false)
	}

	l := zerolog.New(w).Level(zerolog.DebugLevel)

	return &l
}
