package filesystem

import (
	"context"
	"fmt"
	"os"

	"github.com/e2b-dev/infra/packages/envd/internal/permissions"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem"

	"connectrpc.com/connect"
)

func (Service) Stat(ctx context.Context, req *connect.Request[rpc.StatRequest]) (*connect.Response[rpc.StatResponse], error) {
	filePath, err := permissions.ExpandAndResolveFromUsername(req.Msg.GetPath(), req.Msg.GetUser().GetUsername())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("failed to resolve path '%s' for user '%s': %w", req.Msg.GetPath(), req.Msg.GetUser().GetUsername(), err))
	}

	fileInfo, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("file not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error statting file: %w", err))
	}

	var t rpc.FileType
	if fileInfo.IsDir() {
		t = rpc.FileType_FILE_TYPE_DIRECTORY
	} else {
		t = rpc.FileType_FILE_TYPE_FILE
	}

	return connect.NewResponse(
		&rpc.StatResponse{
			Entry: &rpc.EntryInfo{
				Name: fileInfo.Name(),
				Type: t,
			},
		},
	), nil
}
