package main

import (
	"bufio"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/rpc"
	"github.com/gorilla/mux"
	"go.uber.org/zap"

	_ "net/http/pprof"

	"github.com/devbookhq/orchestration-services/fc-env/devbookd/pkg/port"
)

const (
	envFilePath = "/.dbkenv"
)

var (
	slogger *zap.SugaredLogger

	wsHandler http.Handler

	// Env vars
	runCmd             string
	runArgs            string
	parsedRunArgs      []string
	workdir            string
	entrypoint         string
	entrypointFullPath string

	// Address of the default gateway interface inside Firecracker.
	defaultGateway = net.IPv4(169, 254, 0, 21)
)

func serveWs(w http.ResponseWriter, r *http.Request) {
	slogger.Debug("Client connected")
	// TODO: Separate new connection?
	wsHandler.ServeHTTP(w, r)
}

func errLogUndefinedEnvVar(name, value string) {
	if value == "" {
		slogger.Error(
			"The Devbook env var '%s' is empty. Make sure to add the %s var to %s",
			name,
			name,
			envFilePath,
		)
	}
}

func loadDBKEnvs() {
	slogger.Infow("Loading envs from the .dbkenv file", "envFilePath", envFilePath)

	file, err := os.Open(envFilePath)
	if err != nil {
		slogger.Errorw("Failed to open dbkenv file",
			"envFilePath", envFilePath,
			"error", err,
		)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	// Optionally, resize scanner's capacity for lines over 64K, see next example.
	for scanner.Scan() {
		// Expects vars in the format "VAR_NAME=VALUE"
		// ["VAR_NAME", "VALUE"]
		envVar := scanner.Text()

		name, value, found := strings.Cut(envVar, "=")

		if !found {
			slogger.Errorw("Invalid env format in the .dbkenv file",
				"line", envVar,
			)
		}

		slogger.Infow("Devbook env var",
			"name", name,
			"value", value,
		)

		switch name {
		case "RUN_CMD":
			errLogUndefinedEnvVar("RUN_CMD", value)
			runCmd = value
		case "RUN_ARGS":
			errLogUndefinedEnvVar("RUN_ARGS", value)
			runArgs = value
			parsedRunArgs = strings.Fields(runArgs)
		case "WORKDIR":
			errLogUndefinedEnvVar("WORKDIR", value)
			workdir = value
		case "ENTRYPOINT":
			errLogUndefinedEnvVar("ENTRYPOINT", value)
			entrypoint = value
		default:
			slogger.Errorw("Unknown Devbook env var",
				"name", name,
				"value", value,
			)
		}
	}

	if err := scanner.Err(); err != nil {
		slogger.Errorw("Error from scanner for .dbkenv file",
			"error", err,
		)
	}
}

func initLogger() {
	rawJSON := []byte(`{
	  "level": "debug",
	  "encoding": "json",
	  "outputPaths": ["stdout", "/var/log/devbookd.log"],
	  "errorOutputPaths": ["stderr", "/var/log/devbookd.err"],
	  "encoderConfig": {
	    "messageKey": "message",
	    "levelKey": "level",
	    "levelEncoder": "lowercase"
	  }
	}`)

	var cfg zap.Config
	if err := json.Unmarshal(rawJSON, &cfg); err != nil {
		panic(err)
	}
	l, err := cfg.Build()
	if err != nil {
		panic(err)
	}
	slogger = l.Sugar()
}

func main() {
	initLogger()
	defer slogger.Sync()
	slogger.Info("Logger construction succeeded")

	loadDBKEnvs()

	entrypointFullPath = path.Join(workdir, entrypoint)

	router := mux.NewRouter()
	// Register the profiling handlers that were added in default mux with the `net/http/pprof` import.
	router.PathPrefix("/debug/pprof").Handler(http.DefaultServeMux)

	portForwarder := port.NewForwarder(slogger, 1*time.Second, defaultGateway)
	go portForwarder.ScanAndForward()
	server := rpc.NewServer()

	codeSnippetService := NewCodeSnippetService(slogger)
	if err := server.RegisterName("codeSnippet", codeSnippetService); err != nil {
		slogger.Errorw("Failed to register code snippet service", "error", err)
	}

	filesystemService := NewFilesystemService(slogger)
	if err := server.RegisterName("filesystem", filesystemService); err != nil {
		slogger.Errorw("Failed to register filesystem service", "error", err)
	}

	terminalService := NewTerminalService(slogger)
	if err := server.RegisterName("terminal", terminalService); err != nil {
		slogger.Errorw("Failed to register terminal service", "error", err)
	}

	processService := NewProcessService(slogger)
	if err := server.RegisterName("process", processService); err != nil {
		slogger.Errorw("Failed to register process service", "error", err)
	}

	wsHandler = server.WebsocketHandler([]string{"*"})
	router.HandleFunc("/ws", serveWs)

	srv := &http.Server{
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		Addr:         ":8010",
		Handler:      router,
	}

	slogger.Info("Starting server on the port :8010")
	if err := srv.ListenAndServe(); err != nil {
		slogger.Errorw("Failed to start the server", "error", err)
	}
}
