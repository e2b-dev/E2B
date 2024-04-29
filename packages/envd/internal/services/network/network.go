package network

import (
	"github.com/e2b-dev/infra/packages/envd/internal/services/spec"
)

type Service struct {
	spec.UnimplementedNetworkServer
}

func New() *Service {
	return &Service{}
}
