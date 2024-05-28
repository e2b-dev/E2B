package filesystem

import (
	"context"
	"fmt"
	"os"

	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1"

	"connectrpc.com/connect"
)

func (Service) CreateDir(ctx context.Context, req *connect.Request[v1.CreateDirRequest]) (*connect.Response[v1.CreateDirResponse], error) {
	dirPath := req.Msg.GetPath()

	mode, err := permissions.GetMode(req.Msg.GetMode())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid mode: %w", err))
	}

	_, uid, gid, err := permissions.GetUserByUsername(req.Msg.GetOwner().GetUsername())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid owner: %w", err))
	}

	err = os.MkdirAll(dirPath, mode)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error creating directory: %w", err))
	}

	err = os.Chown(dirPath, int(uid), int(gid))
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error setting owner: %w", err))
	}

	return connect.NewResponse(&v1.CreateDirResponse{}), nil
}

func (Service) ListDir(ctx context.Context, req *connect.Request[v1.ListDirRequest]) (*connect.Response[v1.ListDirResponse], error) {
	entries, err := os.ReadDir(req.Msg.GetPath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("directory not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error reading directory: %w", err))
	}

	e := make([]*v1.EntryInfo, len(entries))

	for i, entry := range entries {
		var t v1.FileType
		if entry.IsDir() {
			t = v1.FileType_FILE_TYPE_DIRECTORY
		} else {
			t = v1.FileType_FILE_TYPE_FILE
		}

		e[i] = &v1.EntryInfo{
			Name: entry.Name(),
			Type: t,
		}
	}

	return connect.NewResponse(&v1.ListDirResponse{
		Entries: e,
	}), nil
}
