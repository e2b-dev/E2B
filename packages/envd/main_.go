package main

import (
	"flag"
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"time"

	"github.com/gorilla/handlers"
	"go.uber.org/zap"

	"github.com/e2b-dev/infra/packages/envd/internal/clock"
	"github.com/e2b-dev/infra/packages/envd/internal/env"
	"github.com/e2b-dev/infra/packages/envd/internal/file"
	connectFS "github.com/e2b-dev/infra/packages/envd/internal/services/filesystem"
	"github.com/e2b-dev/infra/packages/shared/pkg/consts"
)

const (
	Version = "dev"

	serverTimeout = 1 * time.Hour
)

var (
	logger    *zap.SugaredLogger
	wsHandler http.Handler

	debug        bool
	serverPort   int64
	versionFlag  bool
	startCmdFlag string
)

func serveWs(w http.ResponseWriter, r *http.Request) {
	logger.Debug("WS connection started")
	wsHandler.ServeHTTP(w, r)
}

func syncHandler(clock *clock.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		logger.Debug("/sync request")
		clock.Sync()

		w.WriteHeader(http.StatusOK)
	}
}

func pingHandler(w http.ResponseWriter, r *http.Request) {
	logger.Debug("/ping request")
	w.WriteHeader(http.StatusOK)

	_, err := w.Write([]byte("pong"))
	if err != nil {
		logger.Error("Error writing response:", err)
	}
}

func createFileHandler(logger *zap.SugaredLogger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			file.Download(logger, w, r)
		case http.MethodPost:
			file.Upload(logger, w, r)
		default:
			http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		}
	}
}

func fileHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		file.Download(logger, w, r)
	case http.MethodPost:
		file.Upload(logger, w, r)
	default:
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
	}
}

func parseFlags() {
	flag.BoolVar(
		&debug,
		"debug",
		false,
		"debug mode prints all logs to stdout and stderr",
	)

	flag.BoolVar(
		&versionFlag,
		"version",
		false,
		"print envd version",
	)

	flag.Int64Var(
		&serverPort,
		"port",
		consts.DefaultEnvdServerPort,
		"a port on which the daemon should run",
	)

	flag.StringVar(
		&startCmdFlag,
		"cmd",
		"",
		"a command to run on the daemon start",
	)

	flag.Parse()
}

func main() {
	parseFlags()

	if versionFlag {
		fmt.Println("Version:\t", Version)

		return
	}

	_, l, err := env.NewEnv(debug)
	if err != nil {
		panic(err)
	}

	logger = l

	defer func() {
		if r := recover(); r != nil {
			logger.Errorf("panic", r)
		}
	}()
	defer logger.Sync()

	// // This server is for the Websocket-RPC communication.
	// rpcServer := rpc.NewServer()

	// portScanner := port.NewScanner(1000 * time.Millisecond)
	// defer portScanner.Destroy()

	// portForwarder := port.NewForwarder(logger, envConfig, portScanner)
	// go portForwarder.StartForwarding()

	// go portScanner.ScanAndBroadcast()

	// clock := clock.NewService(logger.Named("clockSvc"))

	// ports := ports.NewService(logger.Named("codeSnippetSvc"), portScanner)
	// // WARN: Service is still registered as "codeSnippet" because of backward compatibility with  SDK
	// if err := rpcServer.RegisterName("codeSnippet", ports); err != nil {
	// 	logger.Panicw("failed to register ports service", "error", err)
	// }

	// if filesystemService, err := filesystem.NewService(logger.Named("filesystemSvc")); err == nil {
	// 	if err := rpcServer.RegisterName("filesystem", filesystemService); err != nil {
	// 		logger.Panicw("failed to register filesystem service", "error", err)
	// 	}
	// } else {
	// 	logger.Panicw(
	// 		"failed to create filesystem service",
	// 		"err", err,
	// 	)
	// }

	// processService := process.NewService(logger.Named("processSvc"), envConfig, clock)
	// if err := rpcServer.RegisterName("process", processService); err != nil {
	// 	logger.Panicw("failed to register process service", "error", err)
	// }

	// // Start the command passed via the -cmd flag.
	// if startCmdFlag != "" {
	// 	_, err := processService.Start(startCmdID, startCmdFlag, nil, "/")
	// 	// TODO: Do we need to cache the process logs if they are not retrieved?
	// 	// TODO: Should we cache all process logs always?
	// 	if err != nil {
	// 		logger.Errorf(
	// 			"failed to start the command passed via the -cmd flag",
	// 			"cmd", startCmdFlag,
	// 			"err", err,
	// 		)
	// 	}
	// }

	// terminalService := terminal.NewService(logger.Named("terminalSvc"), envConfig, clock)
	// if err := rpcServer.RegisterName("terminal", terminalService); err != nil {
	// 	logger.Panicw("failed to register terminal service", "error", err)
	// }

	// router := mux.NewRouter()
	// wsHandler = rpcServer.WebsocketHandler([]string{"*"})

	// clockHandler := syncHandler(clock)
	// // The /sync route is used for syncing the clock.
	// router.HandleFunc("/sync", clockHandler)

	// router.HandleFunc("/ws", serveWs)
	// // The /ping route is used for the terminal extension to check if envd is running.
	// router.HandleFunc("/ping", pingHandler)
	// // Register the profiling handlers that were added in default mux with the `net/http/pprof` import.
	// router.PathPrefix("/debug/pprof").Handler(http.DefaultServeMux)
	// // The /file route used for downloading and uploading files via SDK.
	// router.HandleFunc("/file", fileHandler)

	mux := http.NewServeMux()

	connectFS.Handle(mux)

	server := &http.Server{
		ReadTimeout:  serverTimeout,
		WriteTimeout: serverTimeout,
		Addr:         fmt.Sprintf("0.0.0.0:%d", serverPort),
		Handler:      handlers.CORS(handlers.AllowedMethods([]string{"GET", "POST", "PUT"}), handlers.AllowedOrigins([]string{"*"}))(mux),
	}

	logger.Debug("Starting server - port: ", serverPort)

	if err := server.ListenAndServe(); err != nil {
		logger.Panicw("Failed to start the server", "error", err)
	}
}
