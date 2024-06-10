package filesystem

import (
	"context"
	"fmt"
	"os"

	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/filesystem"

	"connectrpc.com/connect"
)

func (Service) List(ctx context.Context, req *connect.Request[rpc.ListRequest]) (*connect.Response[rpc.ListResponse], error) {
	u, err := permissions.GetUser(req.Msg.GetUser())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	dirPath, err := permissions.ExpandAndResolve(req.Msg.GetPath(), u)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	stat, err := os.Stat(dirPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("directory not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error getting file info: %w", err))
	}

	if !stat.IsDir() {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("path is not a directory: %s", dirPath))
	}

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error reading directory: %w", err))
	}

	e := make([]*rpc.EntryInfo, len(entries))

	for i, entry := range entries {
		var t rpc.FileType
		if entry.IsDir() {
			t = rpc.FileType_FILE_TYPE_DIRECTORY
		} else {
			t = rpc.FileType_FILE_TYPE_FILE
		}

		e[i] = &rpc.EntryInfo{
			Name: entry.Name(),
			Type: t,
		}
	}

	return connect.NewResponse(&rpc.ListResponse{
		Entries: e,
	}), nil
}

func (Service) MakeDir(ctx context.Context, req *connect.Request[rpc.MakeDirRequest]) (*connect.Response[rpc.MakeDirResponse], error) {
	u, err := permissions.GetUser(req.Msg.GetUser())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	dirPath, err := permissions.ExpandAndResolve(req.Msg.GetPath(), u)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	stat, err := os.Stat(dirPath)
	if err != nil && !os.IsNotExist(err) {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error getting file info: %w", err))
	}

	if err == nil {
		if stat.IsDir() {
			return nil, connect.NewError(connect.CodeAlreadyExists, fmt.Errorf("directory already exists: %s", dirPath))
		}

		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("path already exists but it is not a directory: %s", dirPath))
	}

	uid, gid, userErr := permissions.GetUserIds(u)
	if userErr != nil {
		return nil, connect.NewError(connect.CodeInternal, userErr)
	}

	userErr = permissions.EnsureDirs(dirPath, int(uid), int(gid))
	if userErr != nil {
		return nil, connect.NewError(connect.CodeInternal, userErr)
	}

	return connect.NewResponse(&rpc.MakeDirResponse{}), nil
}
