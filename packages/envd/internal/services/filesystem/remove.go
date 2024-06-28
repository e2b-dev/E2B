package filesystem

import (
	"context"
	"fmt"
	"os"

	"github.com/e2b-dev/infra/packages/envd/internal/permissions"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/filesystem"

	"connectrpc.com/connect"
)

func (Service) Remove(ctx context.Context, req *connect.Request[rpc.RemoveRequest]) (*connect.Response[rpc.RemoveResponse], error) {
	u, err := permissions.GetAuthUser(ctx)
	if err != nil {
		return nil, err
	}

	path, err := permissions.ExpandAndResolve(req.Msg.GetPath(), u)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	err = os.RemoveAll(path)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error removing file or directory: %w", err))
	}

	return connect.NewResponse(&rpc.RemoveResponse{}), nil
}
