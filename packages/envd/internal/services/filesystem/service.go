package filesystem

import (
	"net/http"

	spec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/filesystemconnect"

	"connectrpc.com/connect"
)

type Service struct {
	spec.UnimplementedFilesystemServiceHandler
}

func newService() *Service {
	return &Service{}
}

func Handle(server *http.ServeMux, opts ...connect.HandlerOption) *Service {
	service := newService()

	path, handler := spec.NewFilesystemServiceHandler(service, opts...)

	server.Handle(path, handler)

	return service
}
