package log

import (
	"encoding/json"
	"fmt"
	"path"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func NewLogger(logDir string, debug, mmds bool) (*zap.SugaredLogger, error) {
	if logDir == "" {
		return nil, fmt.Errorf("error creating logger, passed logDir string is empty")
	}

	outputPaths := fmt.Sprintf("\"%s\"", path.Join(logDir, "envd.log"))
	errorOutputPaths := fmt.Sprintf("\"%s\"", path.Join(logDir, "envd.err"))

	if debug {
		outputPaths += ", \"stdout\""
		errorOutputPaths += ", \"stderr\""
	}

	rawJSON := []byte(fmt.Sprintf(`{
	  "level": "debug",
	  "encoding": "json",
	  "outputPaths": [%s],
	  "errorOutputPaths": [%s],
	  "encoderConfig": {
			"timeKey": "timestamp",
	    "messageKey": "message",
	    "levelKey": "level",
	    "levelEncoder": "lowercase",
			"nameKey": "logger",
			"stacktraceKey": "stacktrace"
	  }
	}`, outputPaths, errorOutputPaths))

	var cfg zap.Config
	if err := json.Unmarshal(rawJSON, &cfg); err != nil {
		return nil, fmt.Errorf("error unmarshalling rawJSON: %w", err)
	}

	cfg.EncoderConfig.EncodeTime = zapcore.TimeEncoder(func(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
		enc.AppendString(t.UTC().Format("2006-01-02T15:04:05Z0700"))
		// 2019-08-13T04:39:11Z
	})

	l, err := cfg.Build()
	if err != nil {
		return nil, fmt.Errorf("error building logger: %w", err)
	}

	if !mmds || debug {
		return l.Sugar(), nil
	}

	// mmds is enabled, create a logger that sends logs with info from the FC's MMDS
	var combinedLogger *zap.Logger

	level := zap.DebugLevel

	core := zapcore.NewTee(
		l.Core(),
		zapcore.NewCore(
			zapcore.NewJSONEncoder(cfg.EncoderConfig),
			zapcore.AddSync(&instanceLogsWriter{}),
			level,
		),
	)

	combinedLogger = zap.New(core)

	return combinedLogger.Sugar(), nil
}
