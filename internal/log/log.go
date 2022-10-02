package log

import (
	"encoding/json"
	"fmt"
	"path"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func NewLogger(logDir string, debug bool, mmds bool) (*zap.SugaredLogger, error) {
	if logDir == "" {
		return nil, fmt.Errorf("error creating logger, passed logDir string is empty")
	}

	outputPaths := fmt.Sprintf("\"%s\"", path.Join(logDir, "devbookd.log"))
	errorOutputPaths := fmt.Sprintf("\"%s\"", path.Join(logDir, "devbookd.err"))

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
	    "levelEncoder": "lowercase"
	  }
	}`, outputPaths, errorOutputPaths))

	var cfg zap.Config
	if err := json.Unmarshal(rawJSON, &cfg); err != nil {
		return nil, err
	}
	cfg.EncoderConfig.EncodeTime = zapcore.TimeEncoder(func(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
		enc.AppendString(t.UTC().Format("2006-01-02T15:04:05Z0700"))
		// 2019-08-13T04:39:11Z
	})

	l, err := cfg.Build()
	if err != nil {
		return nil, err
	}

	var combinedLogger *zap.Logger

	if mmds {
		sessionWriter := newSessionWriter(l)

		level := zap.ErrorLevel
		if debug {
			level = zap.DebugLevel
		}

		core := zapcore.NewTee(
			l.Core(),
			zapcore.NewCore(zapcore.NewJSONEncoder(cfg.EncoderConfig), zapcore.AddSync(sessionWriter), level),
		)

		combinedLogger = zap.New(core)
	}

	return combinedLogger.Sugar(), nil
}
