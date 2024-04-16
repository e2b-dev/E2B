package orchestrator

import (
	"fmt"
	"os"

	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"

	e2bgrpc "github.com/e2b-dev/infra/packages/shared/pkg/grpc"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
)

var host = os.Getenv("ORCHESTRATOR_ADDRESS")

type GRPCClient struct {
	Sandbox    orchestrator.SandboxClient
	connection e2bgrpc.ClientConnInterface
}

func NewClient() (*GRPCClient, error) {
	conn, err := e2bgrpc.GetConnection(host, grpc.WithStatsHandler(otelgrpc.NewClientHandler()))
	if err != nil {
		return nil, fmt.Errorf("failed to establish GRPC connection: %w", err)
	}

	client := orchestrator.NewSandboxClient(conn)

	return &GRPCClient{Sandbox: client, connection: conn}, nil
}

func (a *GRPCClient) Close() error {
	err := a.connection.Close()
	if err != nil {
		return fmt.Errorf("failed to close connection: %w", err)
	}

	return nil
}
