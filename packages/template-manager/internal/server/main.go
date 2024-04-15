package server

import (
	"log"

	"github.com/docker/docker/client"
	docker "github.com/fsouza/go-dockerclient"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
	"github.com/e2b-dev/infra/packages/template-manager/internal/constants"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
)

type serverStore struct {
	template_manager.UnimplementedTemplateServiceServer
	server             *grpc.Server
	tracer             trace.Tracer
	dockerClient       *client.Client
	legacyDockerClient *docker.Client
}

func New() *grpc.Server {
	s := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.ChainUnaryInterceptor(
			recovery.UnaryServerInterceptor(),
		),
	)

	dockerClient, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		panic(err)
	}

	legacyClient, err := docker.NewClientFromEnv()
	if err != nil {
		panic(err)
	}

	log.Println("Initializing orchestrator server")

	template_manager.RegisterTemplateServiceServer(s, &serverStore{
		tracer:             otel.Tracer(constants.ServiceName),
		dockerClient:       dockerClient,
		legacyDockerClient: legacyClient,
	})

	grpc_health_v1.RegisterHealthServer(s, health.NewServer())
	return s
}
