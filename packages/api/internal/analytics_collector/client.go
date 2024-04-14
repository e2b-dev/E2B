package analyticscollector

import (
	"fmt"
	"google.golang.org/grpc"
	"os"

	e2bgrpc "github.com/e2b-dev/infra/packages/shared/pkg/grpc"
)

var host = os.Getenv("ANALYTICS_COLLECTOR_HOST")

type Analytics struct {
	Client     AnalyticsCollectorClient
	connection e2bgrpc.ClientConnInterface
}

func NewAnalytics() (*Analytics, error) {
	conn, err := e2bgrpc.GetConnection(host, grpc.WithPerRPCCredentials(&gRPCApiKey{}))
	if err != nil {
		return nil, fmt.Errorf("failed to establish GRPC connection: %w", err)
	}

	client := NewAnalyticsCollectorClient(conn)

	return &Analytics{Client: client, connection: conn}, nil
}

func (a *Analytics) Close() error {
	err := a.connection.Close()
	if err != nil {
		return fmt.Errorf("failed to close connection: %w", err)
	}

	return nil
}
