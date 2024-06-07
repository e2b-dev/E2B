package logs

import (
	"io"
	"log/slog"
	"os"

	"github.com/e2b-dev/infra/packages/envd/internal/logs/exporter"
)

func NewLogger(debug bool) *slog.Logger {
	var w io.Writer
	if debug {
		w = os.Stdout
	} else {
		w = exporter.NewHTTPLogsExporter(false)
	}

	h := slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})

	l := slog.New(h)

	return l
}
