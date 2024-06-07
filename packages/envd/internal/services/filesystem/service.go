package filesystem

import (
	"log/slog"
	"net/http"

	spec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/filesystem/filesystemconnect"

	"connectrpc.com/connect"
)

type Service struct {
	spec.UnimplementedFilesystemHandler
	l *slog.Logger
}

func Handle(server *http.ServeMux, l *slog.Logger, opts ...connect.HandlerOption) {
	service := Service{
		l: l,
	}

	path, handler := spec.NewFilesystemHandler(service, opts...)

	server.Handle(path, handler)
}
