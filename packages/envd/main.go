package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"time"

	"github.com/e2b-dev/infra/packages/envd/internal/api"
	logging "github.com/e2b-dev/infra/packages/envd/internal/log"

	filesystemRpc "github.com/e2b-dev/infra/packages/envd/internal/services/filesystem"
	processRpc "github.com/e2b-dev/infra/packages/envd/internal/services/process"
	"github.com/e2b-dev/infra/packages/envd/internal/services/spec/permissions"
	processSpec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/process"

	connectcors "connectrpc.com/cors"
	"github.com/rs/cors"
	"go.uber.org/zap"
)

const (
	Version = "dev"

	// We limit the timeout more in proxies
	maxTimeout = 24 * time.Hour
	maxAge     = 2 * time.Hour

	defaultPort = 49982
)

var (
	logger    *zap.SugaredLogger
	wsHandler http.Handler

	debug bool
	port  int64

	versionFlag  bool
	startCmdFlag string

	logDir = filepath.Join("/var", "log")
)

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
		&port,
		"port",
		defaultPort,
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

func withCORS(h http.Handler) http.Handler {
	middleware := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{
			"GET",
			"POST",
			"PUT",
		},
		AllowedHeaders: append(
			connectcors.AllowedHeaders(),
			"Origin",
			"Accept",
			"Content-Type",
			"Cache-Control",
			"X-Requested-With",
			"X-Content-Type-Options",
			"Access-Control-Request-Method",
			"Access-Control-Request-Headers",
			"Access-Control-Request-Private-Network",
			"Access-Control-Expose-Headers",
		),
		ExposedHeaders: append(
			connectcors.ExposedHeaders(),
			"Location",
			"Cache-Control",
			"X-Content-Type-Options",
		),
		MaxAge: int(maxAge.Seconds()),
	})
	return middleware.Handler(h)
}

func main() {
	parseFlags()

	if versionFlag {
		fmt.Println("envd version %s", Version)

		return
	}

	l, err := logging.NewLogger(logDir, debug, true)
	if err != nil {
		log.Fatalf("error creating a new logger: %v", err)
	}
	logger = l
	defer l.Sync()

	m := http.NewServeMux()

	filesystemRpc.Handle(m)
	processService := processRpc.Handle(m)

	handler := api.HandlerFromMux(api.New(), m)

	s := &http.Server{
		Handler:           withCORS(handler),
		Addr:              fmt.Sprintf("0.0.0.0:%d", port),
		ReadHeaderTimeout: maxTimeout,
		ReadTimeout:       maxTimeout,
		WriteTimeout:      maxTimeout,
		IdleTimeout:       maxTimeout,
	}

	if startCmdFlag != "" {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		tag := "startCmd"

		processService.StartBackgroundProcess(ctx, &processSpec.StartRequest{
			Tag: &tag,
			User: &permissions.User{
				Selector: &permissions.User_Username{
					Username: "user",
				},
			},
			Process: &processSpec.ProcessConfig{
				Envs: make(map[string]string),
				Cmd:  "/bin/bash",
				Args: []string{"-l", "-c", startCmdFlag},
			},
		})
	}

	err = s.ListenAndServe()
	if err != nil {
		logger.Fatalf("error starting server: %v", err)
	}
}
