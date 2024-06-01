package filesystem

import (
	"context"
	"fmt"
	"os"

	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1"

	"connectrpc.com/connect"
)

func (Service) ListDir(ctx context.Context, req *connect.Request[v1.ListRequest]) (*connect.Response[v1.ListResponse], error) {
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

	return connect.NewResponse(&v1.ListResponse{
		Entries: e,
	}), nil
}
