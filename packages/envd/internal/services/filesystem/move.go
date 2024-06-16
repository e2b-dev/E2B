package filesystem

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/filesystem"

	"connectrpc.com/connect"
)

func (Service) Move(ctx context.Context, req *connect.Request[rpc.MoveRequest]) (*connect.Response[rpc.MoveResponse], error) {
	u, err := permissions.GetUser(req.Msg.GetUser())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	source, err := permissions.ExpandAndResolve(req.Msg.GetSource(), u)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	destination, err := permissions.ExpandAndResolve(req.Msg.GetDestination(), u)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	_, err = os.Stat(source)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("source path not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error statting source: %w", err))
	}

	uid, gid, userErr := permissions.GetUserIds(u)
	if userErr != nil {
		return nil, connect.NewError(connect.CodeInternal, userErr)
	}

	userErr = permissions.EnsureDirs(filepath.Dir(destination), int(uid), int(gid))
	if userErr != nil {
		return nil, connect.NewError(connect.CodeInternal, userErr)
	}

	err = os.Rename(source, destination)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error renaming: %w", err))
	}

	return connect.NewResponse(&rpc.MoveResponse{}), nil
}
