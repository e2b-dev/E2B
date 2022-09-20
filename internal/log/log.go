package log

import (
	"encoding/json"
	"fmt"
	"path"

	"go.uber.org/zap"
)

func NewLogger(logDir string) (*zap.SugaredLogger, error) {
	if logDir == "" {
		return nil, fmt.Errorf("Cannot create a logger, passed logDir string is empty")
	}

	stdout := path.Join(logDir, "devbookd.log")
	stderr := path.Join(logDir, "devbookd.err")

	rawJSON := []byte(fmt.Sprintf(`{
	  "level": "debug",
	  "encoding": "json",
	  "outputPaths": ["%s"],
	  "errorOutputPaths": ["%s"],
	  "encoderConfig": {
	    "messageKey": "message",
	    "levelKey": "level",
	    "levelEncoder": "lowercase"
	  }
	}`, stdout, stderr))

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
