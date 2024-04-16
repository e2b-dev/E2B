package server

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
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

// interceptorLogger adapts go-kit logger to interceptor logger.
// This code is simple enough to be copied and not imported.
func interceptorLogger(l *log.Logger) logging.Logger {
	return logging.LoggerFunc(func(_ context.Context, lvl logging.Level, msg string, fields ...any) {
		switch lvl {
		case logging.LevelDebug:
			msg = fmt.Sprintf("DEBUG :%v", msg)
		case logging.LevelInfo:
			msg = fmt.Sprintf("INFO :%v", msg)
		case logging.LevelWarn:
			msg = fmt.Sprintf("WARN :%v", msg)
		case logging.LevelError:
			msg = fmt.Sprintf("ERROR :%v", msg)
		default:
			panic(fmt.Sprintf("unknown level %v", lvl))
		}
		l.Println(append([]any{"msg", msg}, fields...))
	})
}

func New() *grpc.Server {
	logger := log.New(os.Stdout, "", log.Ldate|log.Ltime|log.Lshortfile)
	opts := []logging.Option{
		logging.WithLogOnEvents(logging.StartCall, logging.FinishCall),
	}

	s := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
		grpc.ChainUnaryInterceptor(
			logging.UnaryServerInterceptor(interceptorLogger(logger), opts...),
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
