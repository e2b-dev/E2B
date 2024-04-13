package server

import (
	"context"
	"log"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	consulapi "github.com/hashicorp/consul/api"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/consul"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/sandbox"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"github.com/e2b-dev/infra/packages/shared/pkg/smap"
	"google.golang.org/grpc/health/grpc_health_v1"
)

type server struct {
	orchestrator.UnimplementedSandboxesServiceServer
	sandboxes *smap.Map[*sandbox.Sandbox]
	dns       *sandbox.DNS
	tracer    trace.Tracer
	consul    *consulapi.Client
}

func New() *grpc.Server {

	s := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.ChainUnaryInterceptor(
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

	orchestrator.RegisterSandboxesServiceServer(s, &server{
		tracer:    otel.Tracer("orchestrator"),
		consul:    consulClient,
		dns:       dns,
		sandboxes: smap.New[*sandbox.Sandbox](),
	})

	grpc_health_v1.RegisterHealthServer(s, health.NewServer())
	return s
}
