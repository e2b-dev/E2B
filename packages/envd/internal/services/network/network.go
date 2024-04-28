package network

import (
	"github.com/e2b-dev/infra/packages/envd/internal/services/spec"
)

type server struct {
	spec.UnimplementedNetworkServer
}

func New() *server {
	return &server{}
}
