package analyticscollector

import (
	"context"
	"os"
)

var apiKey = os.Getenv("ANALYTICS_COLLECTOR_API_TOKEN")

type gRPCApiKey struct{}

func (a *gRPCApiKey) GetRequestMetadata(_ context.Context, _ ...string) (map[string]string, error) {
	return map[string]string{"X-API-key": apiKey}, nil
}

func (a *gRPCApiKey) RequireTransportSecurity() bool {
	return true
}
