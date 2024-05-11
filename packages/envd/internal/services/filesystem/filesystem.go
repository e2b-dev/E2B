package filesystem

import (
	"io"
	"log"
	"os"

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
	path := req.GetPath()
	log.Printf("Received request for path: %s", path)

	fileInfo, err := os.Stat(path)
	if err != nil {
		return status.Errorf(codes.NotFound, "file not found")
	}

	if fileInfo.IsDir() {
		return status.Errorf(codes.InvalidArgument, "file is a directory")
	}

	file, err := os.Open(path)
	if err != nil {
		return status.Errorf(codes.NotFound, "file cannot be opened")
	}
	defer file.Close()

	buffer := make([]byte, 2*1024*1024)

	for {
		bytesread, err := file.Read(buffer)
		if err != nil {
			if err != io.EOF {
				return status.Errorf(codes.Internal, "error reading file")
			}

			break
		}

		err = stream.Send(&spec.ReadFileResponse{
			Data: buffer[:bytesread],
		})
		if err != nil {
			return status.Errorf(codes.Internal, "error sending line")
		}
	}

	return nil
	// return status.Errorf(codes.Unimplemented, "method ReadFile not implemented")
}
