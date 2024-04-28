package services

import (
	"context"

	"github.com/e2b-dev/infra/packages/envd/internal/services/filesystem"
	"github.com/e2b-dev/infra/packages/envd/internal/services/network"
	"github.com/e2b-dev/infra/packages/envd/internal/services/process"
	"github.com/e2b-dev/infra/packages/envd/internal/services/spec"

	"github.com/e2b-dev/infra/packages/shared/pkg/logging"

	grpc_zap "github.com/grpc-ecosystem/go-grpc-middleware/logging/zap"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

func New(ctx context.Context, logger *zap.Logger) *grpc.Server {
	opts := []grpc_zap.Option{logging.WithoutHealthCheck()}

	s := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.ChainUnaryInterceptor(
			grpc_zap.UnaryServerInterceptor(logger, opts...),
			recovery.UnaryServerInterceptor(),
		),
		grpc.ChainStreamInterceptor(
			grpc_zap.StreamServerInterceptor(logger, opts...),
			recovery.StreamServerInterceptor(),
		),
	)

	grpc_health_v1.RegisterHealthServer(s, health.NewServer())

	spec.RegisterFilesystemServer(s, filesystem.New())
	spec.RegisterProcessServer(s, process.New())
	spec.RegisterNetworkServer(s, network.New())

	return s
}
