package process

import (
	"github.com/e2b-dev/infra/packages/envd/internal/services/spec"
)

type server struct {
	spec.UnimplementedProcessServer
}

func New() *server {
	return &server{}
}
