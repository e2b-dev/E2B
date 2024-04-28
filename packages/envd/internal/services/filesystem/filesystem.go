package filesystem

import (
	"github.com/e2b-dev/infra/packages/envd/internal/services/spec"
)

type server struct {
	spec.UnimplementedFilesystemServer
}

func New() *server {
	return &server{}
}
