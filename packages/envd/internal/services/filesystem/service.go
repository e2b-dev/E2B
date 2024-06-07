package filesystem

import (
	"net/http"

	spec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/filesystem/filesystemconnect"

	"connectrpc.com/connect"
	"github.com/rs/zerolog"
)

type Service struct {
	spec.UnimplementedFilesystemHandler
	logger *zerolog.Logger
}

func Handle(server *http.ServeMux, l *zerolog.Logger, opts ...connect.HandlerOption) {
	service := Service{
		logger: l,
	}

	path, handler := spec.NewFilesystemHandler(service, opts...)

	server.Handle(path, handler)
}
