package main

import (
	"net/http"
	_ "net/http/pprof"
	"time"

	"github.com/ethereum/go-ethereum/rpc"
	"github.com/gorilla/mux"
	"go.uber.org/zap"

	"github.com/devbookhq/devbookd/internal/env"
	"github.com/devbookhq/devbookd/internal/log"
	"github.com/devbookhq/devbookd/internal/port"
	"github.com/devbookhq/devbookd/internal/service"
)

var (
	logger    *zap.SugaredLogger
	wsHandler http.Handler
)

func serveWs(w http.ResponseWriter, r *http.Request) {
	logger.Debug("Client connected")
	// TODO: Separate new connection?
	wsHandler.ServeHTTP(w, r)
}

func main() {
	l, err := log.NewLogger()
	if err != nil {
		// We panic because we require logger. Without it we don't know what is happening.
		panic(err)
	}
	logger = l
	defer logger.Sync()
	logger.Info("Logger construction succeeded")

	env, err := env.NewEnv(logger)
	if err != nil {
		// devbookd cannot operate without properly loaded environment.
		panic(err)
	}

	portForwarder := port.NewForwarder(logger, env, 1*time.Second)
	go portForwarder.ScanAndForward()

	// This server is for Websocket-RPC communication
	rpcServer := rpc.NewServer()

	codeSnippetService := service.NewCodeSnippetService(logger, env)
	if err := rpcServer.RegisterName("codeSnippet", codeSnippetService); err != nil {
		logger.Errorw("failed to register code snippet service", "error", err)
	}

	filesystemService := service.NewFilesystemService(logger)
	if err := rpcServer.RegisterName("filesystem", filesystemService); err != nil {
		logger.Errorw("failed to register filesystem service", "error", err)
	}

	terminalService := service.NewTerminalService(logger, env)
	if err := rpcServer.RegisterName("terminal", terminalService); err != nil {
		logger.Errorw("failed to register terminal service", "error", err)
	}

	processService := service.NewProcessService(logger)
	if err := rpcServer.RegisterName("process", processService); err != nil {
		logger.Errorw("failed to register process service", "error", err)
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
