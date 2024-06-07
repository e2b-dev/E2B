package logs

import (
	"io"
	"os"

	"github.com/e2b-dev/infra/packages/envd/internal/logs/exporter"

	"github.com/rs/zerolog"
)

func NewLogger(debug bool) *zerolog.Logger {
	var w io.Writer
	if debug {
		w = os.Stdout
	} else {
		w = exporter.NewHTTPLogsExporter(false)
	}

	l := zerolog.New(w).Level(zerolog.DebugLevel)

	return &l
}
