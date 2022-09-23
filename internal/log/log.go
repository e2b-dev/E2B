package log

import (
	"encoding/json"
	"fmt"
	"path"

	"go.uber.org/zap"
)

func NewLogger(logDir string, debug bool) (*zap.SugaredLogger, error) {
	if logDir == "" {
		return nil, fmt.Errorf("cannot create a logger, passed logDir string is empty")
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
	    "messageKey": "message",
	    "levelKey": "level",
	    "levelEncoder": "lowercase"
	  }
	}`, outputPaths, errorOutputPaths))

	var cfg zap.Config
	if err := json.Unmarshal(rawJSON, &cfg); err != nil {
		return nil, err
	}
	l, err := cfg.Build()
	if err != nil {
		return nil, err
	}

	return l.Sugar(), nil
}
