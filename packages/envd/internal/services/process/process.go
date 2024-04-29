package process

import (
	"github.com/e2b-dev/infra/packages/envd/internal/services/spec"
)

type Service struct {
	spec.UnimplementedProcessServer
}

func New() *Service {
	return &Service{}
}
