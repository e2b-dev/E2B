package filesystem

import (
	"context"
	"fmt"
	"os"

	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem"

	"connectrpc.com/connect"
)

func (Service) Remove(ctx context.Context, req *connect.Request[rpc.RemoveRequest]) (*connect.Response[rpc.RemoveResponse], error) {
	path := req.Msg.GetPath()

	err := os.RemoveAll(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("file or directory not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error removing file or directory: %w", err))
	}

	return connect.NewResponse(&rpc.RemoveResponse{}), nil
}
