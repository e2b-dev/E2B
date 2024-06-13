package filesystem

import (
	"github.com/e2b-dev/infra/packages/envd/internal/logs"
	spec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/filesystem/filesystemconnect"

	"connectrpc.com/connect"
	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
)

type Service struct {
	logger *zerolog.Logger
}

func Handle(server *chi.Mux, l *zerolog.Logger) {
	service := Service{
		logger: l,
	}

	interceptors := connect.WithInterceptors(logs.NewUnaryLogInterceptor(l))

	path, handler := spec.NewFilesystemHandler(service, interceptors)

	server.Handle(path, handler)
}
