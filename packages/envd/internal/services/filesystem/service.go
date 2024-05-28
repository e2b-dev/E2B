package filesystem

import (
	"net/http"

	specconnect "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1/filesystemv1connect"

	"connectrpc.com/connect"
)

type Service struct {
	specconnect.UnimplementedFilesystemServiceHandler
}

func newService() *Service {
	return &Service{}
}

func Handle(server *http.ServeMux, opts ...connect.HandlerOption) {
	service := newService()

	path, handler := specconnect.NewFilesystemServiceHandler(service, opts...)

	server.Handle(path, handler)
}
