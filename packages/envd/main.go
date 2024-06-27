package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/e2b-dev/infra/packages/envd/internal/api"
	"github.com/e2b-dev/infra/packages/envd/internal/logs"

	filesystemRpc "github.com/e2b-dev/infra/packages/envd/internal/services/filesystem"
	processRpc "github.com/e2b-dev/infra/packages/envd/internal/services/process"
	"github.com/e2b-dev/infra/packages/envd/internal/services/spec/permissions"
	processSpec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/process"

	connectcors "connectrpc.com/cors"
	"github.com/go-chi/chi/v5"
	"github.com/rs/cors"
)

const (
	// We limit the timeout more in proxies
	maxTimeout = 24 * time.Hour
	maxAge     = 2 * time.Hour

	defaultPort = 49983
)

var (
	Version = "dev"

	debug bool
	port  int64

	versionFlag  bool
	buildFlag    bool
	startCmdFlag string

	build string
)

func parseFlags() {
	flag.BoolVar(
		&debug,
		"debug",
		false,
		"debug mode prints all logs to stdout",
	)

	flag.BoolVar(
		&versionFlag,
		"version",
		false,
		"print envd version",
	)

	flag.BoolVar(
		&buildFlag,
		"build",
		false,
		"print git commit hash of the build",
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
		fmt.Printf("envd %s (git: %s) \n", Version, build)

		return
	}

	if buildFlag {
		fmt.Println(build)

		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	l := logs.NewLogger(ctx, debug)

	m := chi.NewRouter()

	fsLogger := l.With().Str("service", "filesystem").Logger()
	filesystemRpc.Handle(m, &fsLogger)

	processLogger := l.With().Str("service", "process").Logger()
	processService := processRpc.Handle(m, &processLogger)

	handler := api.HandlerFromMux(api.New(&fsLogger), m)

	s := &http.Server{
		Handler:           withCORS(handler),
		Addr:              fmt.Sprintf("0.0.0.0:%d", port),
		ReadHeaderTimeout: maxTimeout,
		ReadTimeout:       maxTimeout,
		WriteTimeout:      maxTimeout,
		IdleTimeout:       maxTimeout,
	}

	if startCmdFlag != "" {
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

	err := s.ListenAndServe()
	if err != nil {
		log.Fatalf("error starting server: %v", err)
	}
}
