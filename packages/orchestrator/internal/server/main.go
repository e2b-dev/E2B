package server

import (
	"context"
	"log"

	grpc_zap "github.com/grpc-ecosystem/go-grpc-middleware/logging/zap"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	consulapi "github.com/hashicorp/consul/api"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/constants"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/consul"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/sandbox"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"github.com/e2b-dev/infra/packages/shared/pkg/logging"
	"github.com/e2b-dev/infra/packages/shared/pkg/smap"
)

type server struct {
	orchestrator.UnimplementedSandboxServer
	sandboxes *smap.Map[*sandbox.Sandbox]
	dns       *sandbox.DNS
	tracer    trace.Tracer
	consul    *consulapi.Client
}

func New(logger *zap.Logger) *grpc.Server {
	opts := []grpc_zap.Option{logging.WithoutHealthCheck()}

	s := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.ChainUnaryInterceptor(
			grpc_zap.UnaryServerInterceptor(logger, opts...),
			recovery.UnaryServerInterceptor(),
		),
	)

	log.Println("Initializing orchestrator server")

	ctx := context.Background()

	dns, err := sandbox.NewDNS()
	if err != nil {
		panic(err)
	}

	consulClient, err := consul.New(ctx)
	if err != nil {
		panic(err)
	}

	orchestrator.RegisterSandboxServer(s, &server{
		tracer:    otel.Tracer(constants.ServiceName),
		consul:    consulClient,
		dns:       dns,
		sandboxes: smap.New[*sandbox.Sandbox](),
	})

	grpc_health_v1.RegisterHealthServer(s, health.NewServer())

	return s
}
