package logging

import (
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/e2b-dev/infra/packages/shared/pkg/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/logging/exporter"
)

func NewCollectorLogger() (*zap.SugaredLogger, error) {
	encoderConfig := zapcore.EncoderConfig{
		TimeKey:       "timestamp",
		MessageKey:    "message",
		LevelKey:      "level",
		EncodeLevel:   zapcore.LowercaseLevelEncoder,
		NameKey:       "logger",
		StacktraceKey: "stacktrace",
	}

	encoderConfig.EncodeTime = zapcore.TimeEncoder(func(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
		enc.AppendString(t.UTC().Format("2006-01-02T15:04:05Z0700"))
		// 2019-08-13T04:39:11Z
	})

	level := zap.NewAtomicLevelAt(zap.InfoLevel)

	core := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.AddSync(exporter.NewHTTPLogsExporter(env.IsLocal())),
		level,
	)

	logger := zap.New(core)

	return logger.Sugar(), nil
}
