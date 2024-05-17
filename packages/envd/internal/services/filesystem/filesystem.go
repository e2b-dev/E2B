package filesystem

import (
	"context"
	"net/http"
	"os"
	"time"

	spec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1"
	specconnect "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1/filesystemv1connect"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Service struct {
	specconnect.UnimplementedFilesystemServiceHandler
}

func Handle(server *http.ServeMux, opts ...connect.HandlerOption) {
	path, handler := specconnect.NewFilesystemServiceHandler(Service{}, opts...)

	server.Handle(path, handler)
}

func (s Service) ListDir(ctx context.Context, req *connect.Request[spec.ListDirRequest]) (*connect.Response[spec.ListDirResponse], error) {
	files, err := os.ReadDir(req.Msg.Path)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	l := len(files)
	entries := make([]*spec.EntryInfo, l, l)

	user := "user"

	for i, file := range files {
		entries[i] = &spec.EntryInfo{
			Name:         file.Name(),
			LastModified: timestamppb.New(time.Now()),
			Size:         0,
			Type:         spec.EntryInfo_FILE_TYPE_FILE,
			Mode:         0,
			Owner: &spec.AccessControl{
				User: &user,
			},
		}
	}

	return connect.NewResponse(&spec.ListDirResponse{
		Entries: entries,
	}), nil
}

func (s Service) Watch(ctx context.Context, req *connect.Request[spec.WatchRequest], stream *connect.ServerStream[spec.FilesystemEvent]) error {
	_ = stream.Send(&spec.FilesystemEvent{
		Path: "path1",
	})

	_ = stream.Send(&spec.FilesystemEvent{
		Path: "path2",
	})

	time.Sleep(time.Second * 2)

	_ = stream.Send(&spec.FilesystemEvent{
		Path: "path3",
	})

	return nil
}
