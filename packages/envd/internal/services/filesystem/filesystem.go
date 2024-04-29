package filesystem

import (
	"github.com/e2b-dev/infra/packages/envd/internal/services/spec"

	"github.com/gogo/status"
	"google.golang.org/grpc/codes"
)

type Service struct {
	spec.UnimplementedFilesystemServer
}

func New() *Service {
	return &Service{}
}

func (s *Service) ReadFile(req *spec.ReadFileRequest, stream spec.Filesystem_ReadFileServer) error {
	return status.Errorf(codes.Unimplemented, "method ReadFile not implemented")
}
