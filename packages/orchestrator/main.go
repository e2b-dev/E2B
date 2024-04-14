package main

import (
	"flag"
	"fmt"
	"log"
	"net"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/server"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/test"

	"github.com/e2b-dev/infra/packages/shared/pkg/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	serviceName = "orchestrator"
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
	if test.Run(envID, instanceID, keepAlive, count) {
		return
	}

	if env.IsProduction() {
		shutdown := telemetry.InitOTLPExporter(serviceName, "no")
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
