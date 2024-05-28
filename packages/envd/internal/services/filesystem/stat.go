package filesystem

import (
	"context"
	"fmt"
	"os"

	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1"

	"connectrpc.com/connect"
)

func (Service) Stat(ctx context.Context, req *connect.Request[v1.StatRequest]) (*connect.Response[v1.StatResponse], error) {
	filePath := req.Msg.GetPath()

	fileInfo, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("file not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error statting file: %w", err))
	}

	var t v1.FileType
	if fileInfo.IsDir() {
		t = v1.FileType_FILE_TYPE_DIRECTORY
	} else {
		t = v1.FileType_FILE_TYPE_FILE
	}

	return connect.NewResponse(
		&v1.StatResponse{
			Entry: &v1.EntryInfo{
				Name: fileInfo.Name(),
				Type: t,
			},
		},
	), nil
}
