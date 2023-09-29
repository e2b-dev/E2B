package main

import (
	"flag"
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"time"

	"github.com/ethereum/go-ethereum/rpc"
	"github.com/gorilla/mux"
	"go.uber.org/zap"

	codesnippet "github.com/e2b-dev/infra/packages/envd/internal/codesnippet"
	"github.com/e2b-dev/infra/packages/envd/internal/env"
	"github.com/e2b-dev/infra/packages/envd/internal/filesystem"
	"github.com/e2b-dev/infra/packages/envd/internal/port"
	"github.com/e2b-dev/infra/packages/envd/internal/process"
	"github.com/e2b-dev/infra/packages/envd/internal/terminal"
)

// TODO: I'm not really sure if we're using RPC Notifier and Subscriber in the right way.
// There isn't an explicit documentation, I'm using source code of tests as a reference:
// https://cs.github.com/ethereum/go-ethereum/blob/440c9fcf75d9d5383b72646a65d5e21fa7ab6a26/rpc/testservice_test.go#L160

var (
	logger    *zap.SugaredLogger
	wsHandler http.Handler

	debug       bool
	serverPort  uint
	versionFlag bool

	Version                = "dev"
	defaultServerPort uint = 49982
)

func serveWs(w http.ResponseWriter, r *http.Request) {
	logger.Debug("Client connected")
	wsHandler.ServeHTTP(w, r)
}

func pingHandler(w http.ResponseWriter, r *http.Request) {
	logger.Info("/ping request")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("pong"))
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

	flag.UintVar(
		&serverPort,
		"port",
		defaultServerPort,
		"a port on which the daemon should run",
	)

	flag.Parse()
}

func main() {
	parseFlags()

	if versionFlag {
		fmt.Println("Version:\t", Version)

		return
	}

	envConfig, l, err := env.NewEnv(debug)
	if err != nil {
		panic(err)
	}

	logger = l

	defer func() {
		if r := recover(); r != nil {
			logger.Infow("panic", r)
		}
	}()
	defer logger.Sync()
	logger.Info("Logger and environment construction succeeded")

	// This server is for the Websocket-RPC communication.
	rpcServer := rpc.NewServer()

	portScanner := port.NewScanner(1000 * time.Millisecond)
	defer portScanner.Destroy()

	portForwarder := port.NewForwarder(logger, envConfig, portScanner)
	go portForwarder.StartForwarding()

	go portScanner.ScanAndBroadcast()

	codeSnippetService := codesnippet.NewService(logger.Named("codeSnippetSvc"), portScanner)
	if err := rpcServer.RegisterName("codeSnippet", codeSnippetService); err != nil {
		logger.Panicw("failed to register code snippet service", "error", err)
	}

	if filesystemService, err := filesystem.NewService(logger.Named("filesystemSvc")); err == nil {
		if err := rpcServer.RegisterName("filesystem", filesystemService); err != nil {
			logger.Panicw("failed to register filesystem service", "error", err)
		}
	} else {
		logger.Panicw(
			"failed to create filesystem service",
			"err", err,
		)
	}

	processService := process.NewService(logger.Named("processSvc"), envConfig)
	if err := rpcServer.RegisterName("process", processService); err != nil {
		logger.Panicw("failed to register process service", "error", err)
	}

	terminalService := terminal.NewService(logger.Named("terminalSvc"), envConfig)
	if err := rpcServer.RegisterName("terminal", terminalService); err != nil {
		logger.Panicw("failed to register terminal service", "error", err)
	}

	router := mux.NewRouter()
	wsHandler = rpcServer.WebsocketHandler([]string{"*"})
	router.HandleFunc("/ws", serveWs)
	// The /ping route is used for the terminal extension to check if envd is running.
	router.HandleFunc("/ping", pingHandler)
	// Register the profiling handlers that were added in default mux with the `net/http/pprof` import.
	router.PathPrefix("/debug/pprof").Handler(http.DefaultServeMux)

	server := &http.Server{
		ReadTimeout:  40 * time.Second,
		WriteTimeout: 40 * time.Second,
		Addr:         fmt.Sprintf("0.0.0.0:%d", serverPort),
		Handler:      router,
	}

	logger.Infow("Starting server",
		"port", serverPort,
	)

	if err := server.ListenAndServe(); err != nil {
		logger.Panicw("Failed to start the server", "error", err)
	}
}
