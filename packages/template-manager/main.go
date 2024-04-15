package main

import (
	"flag"
	"fmt"
	"github.com/e2b-dev/infra/packages/template-manager/internal/constants"
	"github.com/e2b-dev/infra/packages/template-manager/internal/test"
	"log"
	"net"

	"github.com/e2b-dev/infra/packages/shared/pkg/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/e2b-dev/infra/packages/template-manager/internal/server"
)

const (
	defaultPort = 5009
)

func main() {
	envID := flag.String("env", "", "env id")
	buildID := flag.String("build", "", "build id")

	port := flag.Int("port", defaultPort, "Port for test HTTP server")

	flag.Parse()

	// If we're running a test, we don't need to start the server
	if *envID != "" && *buildID != "" {
		test.Build(*envID, *buildID)
		return
	}
	// TODO: Add test for deleting

	if env.IsProduction() {
		shutdown := telemetry.InitOTLPExporter(constants.ServiceName, "no")
		defer shutdown()
	}

	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", *port))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	// Create an instance of our handler which satisfies the generated interface
	s := server.New()

	log.Printf("Starting server on port %d", *port)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
