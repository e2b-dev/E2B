package network

import (
	"net/http"

	// spec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/network/v1"
	specconnect "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/network/v1/networkv1connect"

	"connectrpc.com/connect"
)

type Service struct {
	specconnect.UnimplementedNetworkServiceHandler
}

func Handle(server *http.ServeMux, opts ...connect.HandlerOption) {
	path, handler := specconnect.NewNetworkServiceHandler(Service{}, opts...)

	server.Handle(path, handler)
}
