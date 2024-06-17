package logs

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/e2b-dev/infra/packages/envd/internal/logs/exporter"

	"github.com/rs/zerolog"
)

func consoleLogger() zerolog.ConsoleWriter {
	output := zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}

	output.FormatLevel = func(i interface{}) string {
		return strings.ToUpper(fmt.Sprintf("| %-6s|", i))
	}
	output.FormatMessage = func(i interface{}) string {
		return fmt.Sprintf("***%s****", i)
	}
	output.FormatFieldName = func(i interface{}) string {
		return fmt.Sprintf("%s:", i)
	}
	output.FormatFieldValue = func(i interface{}) string {
		return strings.ToUpper(fmt.Sprintf("%s", i))
	}

	return output
}

func NewLogger(ctx context.Context, debug bool) *zerolog.Logger {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

	exporters := []io.Writer{
		consoleLogger(),
	}

	if !debug {
		exporters = append(exporters, exporter.NewHTTPLogsExporter(ctx, false))
	}

	l := zerolog.
		New(io.MultiWriter(exporters...)).
		Level(zerolog.DebugLevel)

	return &l
}
