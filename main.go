package main

import (
	"flag"
	"net/http"
	_ "net/http/pprof"
	"time"

	"github.com/ethereum/go-ethereum/rpc"
	"github.com/gorilla/mux"
	"go.uber.org/zap"

	"github.com/devbookhq/devbookd/internal/env"
	"github.com/devbookhq/devbookd/internal/port"
	"github.com/devbookhq/devbookd/internal/service"
)

var (
	logger    *zap.SugaredLogger
	wsHandler http.Handler

	rawRuntimeMode string
)

func serveWs(w http.ResponseWriter, r *http.Request) {
	logger.Debug("Client connected")
	// TODO: Separate new connection?
	wsHandler.ServeHTTP(w, r)
}

func parseFlags() {
	// -mode="user" or -mode="server"
	// "server" is default
	flag.StringVar(
		&rawRuntimeMode,
		"mode",
		string(env.RuntimeModeServer),
		"a runtime mode in which the daemon should run. Affects things like logs and loading env vars. Accepted values are either 'server' or 'user'",
	)
	flag.Parse()
}

func main() {
	parseFlags()

	newEnv, l, err := env.NewEnv(rawRuntimeMode)
	if err != nil {
		panic(err)
	}
	logger = l
	defer logger.Sync()
	logger.Info("Logger and environment construction succeeded")

	// This server is for the Websocket-RPC communication.
	rpcServer := rpc.NewServer()

	if newEnv.RuntimeMode() == env.RuntimeModeServer {
		portScanner := port.NewScanner(1 * time.Second)
		defer portScanner.Destroy()

		go portScanner.ScanAndBroadcast()

		portForwarder := port.NewForwarder(logger, newEnv, portScanner)
		go portForwarder.StartForwarding()

		codeSnippetService := service.NewCodeSnippetService(logger, newEnv, portScanner)
		if err := rpcServer.RegisterName("codeSnippet", codeSnippetService); err != nil {
			logger.Errorw("failed to register code snippet service", "error", err)
		}

		filesystemService := service.NewFilesystemService(logger)
		if err := rpcServer.RegisterName("filesystem", filesystemService); err != nil {
			logger.Errorw("failed to register filesystem service", "error", err)
		}

		processService := service.NewProcessService(logger)
		if err := rpcServer.RegisterName("process", processService); err != nil {
			logger.Errorw("failed to register process service", "error", err)
		}
	}

	terminalService := service.NewTerminalService(logger, newEnv)
	if err := rpcServer.RegisterName("terminal", terminalService); err != nil {
		logger.Errorw("failed to register terminal service", "error", err)
	}

	router := mux.NewRouter()
	wsHandler = rpcServer.WebsocketHandler([]string{"*"})
	router.HandleFunc("/ws", serveWs)
	// Register the profiling handlers that were added in default mux with the `net/http/pprof` import.
	router.PathPrefix("/debug/pprof").Handler(http.DefaultServeMux)

	server := &http.Server{
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		Addr:         ":8010",
		Handler:      router,
	}

	logger.Info("Starting server on the port :8010")
	if err := server.ListenAndServe(); err != nil {
		logger.Errorw("Failed to start the server", "error", err)
	}
}
