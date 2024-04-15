package server

import (
	"github.com/e2b-dev/infra/packages/template-manager/internal/constants"
	"log"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"

	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
	"google.golang.org/grpc/health/grpc_health_v1"
)

type server struct {
	template_manager.UnimplementedTemplateServiceServer
	tracer trace.Tracer
}

func New() *grpc.Server {
	s := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.ChainUnaryInterceptor(
			recovery.UnaryServerInterceptor(),
		),
	)

	log.Println("Initializing orchestrator server")

	template_manager.RegisterTemplateServiceServer(s, &server{
		tracer: otel.Tracer(constants.ServiceName),
	})

	grpc_health_v1.RegisterHealthServer(s, health.NewServer())
	return s
}
