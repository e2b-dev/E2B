package process

import (
	"net/http"

	// spec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1"
	specconnect "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1/processv1connect"

	"connectrpc.com/connect"
)

type Service struct {
	specconnect.UnimplementedProcessServiceHandler
}

func Handle(server *http.ServeMux, opts ...connect.HandlerOption) {
	path, handler := specconnect.NewProcessServiceHandler(Service{}, opts...)

	server.Handle(path, handler)
}
