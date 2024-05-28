package filesystem

import (
	"context"
	"fmt"
	"os"
	"syscall"

	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1"

	"connectrpc.com/connect"
)

func (Service) Rename(ctx context.Context, req *connect.Request[v1.RenameRequest]) (*connect.Response[v1.RenameResponse], error) {
	source := req.Msg.GetSource()
	destination := req.Msg.GetDestination()

	fileInfo, err := os.Stat(source)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("source file not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error statting source file: %w", err))
	}

	stat, ok := fileInfo.Sys().(*syscall.Stat_t)
	if !ok {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to get raw syscall.Stat_t data for '%s'", source))
	}

	err = os.Rename(source, destination)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("source file not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error renaming file: %w", err))
	}

	err = os.Chown(destination, int(stat.Uid), int(stat.Gid))
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error setting owner: %w", err))
	}

	return connect.NewResponse(&v1.RenameResponse{}), nil
}
