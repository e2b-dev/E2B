package logging

import (
	"fmt"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func New(prod bool) (*zap.SugaredLogger, error) {
	config := zap.Config{
		Level:             zap.NewAtomicLevelAt(zap.InfoLevel),
		Development:       !prod,
		DisableStacktrace: prod,
		Encoding:          "console",
		EncoderConfig: zapcore.EncoderConfig{
			TimeKey:       "timestamp",
			MessageKey:    "message",
			LevelKey:      "level",
			EncodeLevel:   zapcore.LowercaseLevelEncoder,
			NameKey:       "logger",
			StacktraceKey: "stacktrace",
		},
		OutputPaths: []string{
			"stdout",
		},
		ErrorOutputPaths: []string{
			"stderr",
		},
	}

	config.EncoderConfig.EncodeTime = zapcore.TimeEncoder(func(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
		enc.AppendString(t.UTC().Format("2006-01-02T15:04:05Z0700"))
		// 2019-08-13T04:39:11Z
	})

	logger, err := config.Build()
	if err != nil {
		return nil, fmt.Errorf("error building logger: %w", err)
	}

	return logger.Sugar(), nil
}
