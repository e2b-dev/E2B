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

	"github.com/devbookhq/devbook-api/packages/devbookd/internal/codeSnippet"
	"github.com/devbookhq/devbook-api/packages/devbookd/internal/env"
	"github.com/devbookhq/devbook-api/packages/devbookd/internal/filesystem"
	"github.com/devbookhq/devbook-api/packages/devbookd/internal/port"
	"github.com/devbookhq/devbook-api/packages/devbookd/internal/process"
	"github.com/devbookhq/devbook-api/packages/devbookd/internal/terminal"
)

// TODO: I'm not really sure if we're using RPC Notifier and Subscriber in the right way.
// There isn't an explicit documentation, I'm using source code of tests as a reference:
// https://cs.github.com/ethereum/go-ethereum/blob/440c9fcf75d9d5383b72646a65d5e21fa7ab6a26/rpc/testservice_test.go#L160

var (
	logger    *zap.SugaredLogger
	wsHandler http.Handler

	rawRuntimeMode string
	debug          bool
	serverPort     uint
	versionFlag    bool

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

	newEnv, l, err := env.NewEnv(rawRuntimeMode, debug)
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

	if newEnv.RuntimeMode() == env.RuntimeModeServer {
		portScanner := port.NewScanner(1000 * time.Millisecond)
		defer portScanner.Destroy()

		portForwarder := port.NewForwarder(logger, newEnv, portScanner)
		go portForwarder.StartForwarding()

		go portScanner.ScanAndBroadcast()

		codeSnippetService := codeSnippet.NewService(logger.Named("codeSnippetSvc"), newEnv, portScanner)
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

		processService := process.NewService(logger.Named("processSvc"))
		if err := rpcServer.RegisterName("process", processService); err != nil {
			logger.Panicw("failed to register process service", "error", err)
		}
	}

	terminalService := terminal.NewService(logger.Named("terminalSvc"), newEnv)
	if err := rpcServer.RegisterName("terminal", terminalService); err != nil {
		logger.Panicw("failed to register terminal service", "error", err)
	}

	router := mux.NewRouter()
	wsHandler = rpcServer.WebsocketHandler([]string{"*"})
	router.HandleFunc("/ws", serveWs)
	// The /ping route is used for the terminal extension to check if devbookd is running.
	router.HandleFunc("/ping", pingHandler)
	// Register the profiling handlers that were added in default mux with the `net/http/pprof` import.
	router.PathPrefix("/debug/pprof").Handler(http.DefaultServeMux)

	server := &http.Server{
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		Addr:         fmt.Sprintf(":%d", serverPort),
		Handler:      router,
	}

	logger.Infow("Starting server",
		"port", serverPort,
	)
	if err := server.ListenAndServe(); err != nil {
		logger.Panicw("Failed to start the server", "error", err)
	}
}
