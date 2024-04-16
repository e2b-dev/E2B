package main

import (
	"flag"
	"fmt"
	"log"
	"net"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/constants"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/server"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/test"
	"github.com/e2b-dev/infra/packages/shared/pkg/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/logging"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	defaultPort = 5008
)

func main() {
	envID := flag.String("env", "", "env id")
	instanceID := flag.String("instance", "", "instance id")
	keepAlive := flag.Int("alive", 0, "keep alive")
	count := flag.Int("count", 1, "number of spawned instances")

	port := flag.Int("port", defaultPort, "Port for test HTTP server")

	flag.Parse()

	// If we're running a test, we don't need to start the server
	if *envID != "" && *instanceID != "" {
		test.Run(*envID, *instanceID, keepAlive, count)
		return
	}

	if env.IsProduction() {
		shutdown := telemetry.InitOTLPExporter(constants.ServiceName, "no")
		defer shutdown()
	}

	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", *port))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	logger, err := logging.New(env.IsProduction())
	if err != nil {
		log.Fatalf("Error initializing logging\n: %v\n", err)
	}
	// Create an instance of our handler which satisfies the generated interface
	s := server.New(logger.Desugar())

	log.Printf("Starting server on port %d", *port)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
