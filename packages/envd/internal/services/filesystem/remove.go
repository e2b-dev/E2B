package filesystem

import (
	"context"
	"fmt"
	"os"

	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1"

	"connectrpc.com/connect"
)

func (Service) Remove(ctx context.Context, req *connect.Request[v1.RemoveRequest]) (*connect.Response[v1.RemoveResponse], error) {
	path := req.Msg.GetPath()
	recursive := req.Msg.GetRecursive()

	var err error
	if recursive {
		err = os.RemoveAll(path)
	} else {
		err = os.Remove(path)
	}

	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("file or directory not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error removing file or directory: %w", err))
	}

	return connect.NewResponse(&v1.RemoveResponse{}), nil
}
