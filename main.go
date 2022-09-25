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

	"github.com/devbookhq/devbookd/internal/codeSnippet"
	"github.com/devbookhq/devbookd/internal/env"
	"github.com/devbookhq/devbookd/internal/filesystem"
	"github.com/devbookhq/devbookd/internal/port"
	"github.com/devbookhq/devbookd/internal/process"
	"github.com/devbookhq/devbookd/internal/terminal"
)

// TODO: I'm not really sure if we're using RPC Notifier and Subscriber in the right way.
// There isn't an explicit documentation, I'm using source code of tests as a reference:
// https://cs.github.com/ethereum/go-ethereum/blob/440c9fcf75d9d5383b72646a65d5e21fa7ab6a26/rpc/testservice_test.go#L160

var (
	logger    *zap.SugaredLogger
	wsHandler http.Handler

	rawRuntimeMode string
	debug          bool
	versionFlag    bool
	Version        = "dev"
)

func serveWs(w http.ResponseWriter, r *http.Request) {
	logger.Debug("Client connected")
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
		"print devbookd version",
	)

	flag.Parse()
}

func main() {
	parseFlags()

	if versionFlag {
		fmt.Println("Version:\t", Version)
		return
	}

	newEnv, l, err := env.NewEnv(rawRuntimeMode, debug)
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

		codeSnippetService := codeSnippet.NewService(logger, newEnv, portScanner)
		if err := rpcServer.RegisterName("codeSnippet", codeSnippetService); err != nil {
			logger.Errorw("failed to register code snippet service", "error", err)
		}

		filesystemService := filesystem.NewService(logger)
		if err := rpcServer.RegisterName("filesystem", filesystemService); err != nil {
			logger.Errorw("failed to register filesystem service", "error", err)
		}

		processService := process.NewService(logger)
		if err := rpcServer.RegisterName("process", processService); err != nil {
			logger.Errorw("failed to register process service", "error", err)
		}
	}

	terminalService := terminal.NewService(logger, newEnv)
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
