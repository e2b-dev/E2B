package filesystem

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/filesystem"

	"connectrpc.com/connect"
	"github.com/fsnotify/fsnotify"
)

func (Service) Watch(ctx context.Context, req *connect.Request[rpc.WatchRequest], stream *connect.ServerStream[rpc.WatchResponse]) error {
	u, err := permissions.GetUser(req.Msg.GetUser())
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	watchPath, err := permissions.ExpandAndResolve(req.Msg.GetPath(), u)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	info, err := os.Stat(watchPath)
	if err != nil && !os.IsNotExist(err) {
		return connect.NewError(connect.CodeInternal, fmt.Errorf("error statting path %s: %w", watchPath, err))
	}

	if os.IsNotExist(err) {
		watchPath = filepath.Dir(watchPath)

		info, err = os.Stat(watchPath)
		if err != nil {
			return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("parent path %s not found: %w", watchPath, err))
		}

		if !info.IsDir() {
			return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("parent path %s not a directory: %w", watchPath, err))
		}
	}

	w, err := fsnotify.NewWatcher()
	if err != nil {
		return connect.NewError(connect.CodeInternal, fmt.Errorf("error creating watcher: %w", err))
	}
	defer w.Close()

	err = w.Add(watchPath)
	if err != nil {
		return connect.NewError(connect.CodeInternal, fmt.Errorf("error adding path %s to watcher: %w", watchPath, err))
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case chErr, ok := <-w.Errors:
			if !ok {
				return connect.NewError(connect.CodeInternal, fmt.Errorf("watcher error channel closed"))
			}

			return connect.NewError(connect.CodeInternal, fmt.Errorf("watcher error: %w", chErr))
		case e, ok := <-w.Events:
			if !ok {
				return connect.NewError(connect.CodeInternal, fmt.Errorf("watcher event channel closed"))
			}

			if !info.IsDir() && e.Name != info.Name() {
				continue
			}

			// One event can have multiple operations.
			ops := []rpc.EventType{}

			if fsnotify.Create.Has(e.Op) {
				ops = append(ops, rpc.EventType_EVENT_TYPE_CREATE)
			}

			if fsnotify.Rename.Has(e.Op) {
				ops = append(ops, rpc.EventType_EVENT_TYPE_RENAME)
			}

			if fsnotify.Chmod.Has(e.Op) {
				ops = append(ops, rpc.EventType_EVENT_TYPE_CHMOD)
			}

			if fsnotify.Write.Has(e.Op) {
				ops = append(ops, rpc.EventType_EVENT_TYPE_WRITE)
			}

			if fsnotify.Remove.Has(e.Op) {
				ops = append(ops, rpc.EventType_EVENT_TYPE_REMOVE)
			}

			for _, op := range ops {
				streamErr := stream.Send(&rpc.WatchResponse{
					Event: &rpc.FilesystemEvent{
						Path: filepath.Join(watchPath, e.Name),
						Type: op,
					},
				})
				if streamErr != nil {
					return connect.NewError(connect.CodeAborted, streamErr)
				}
			}
		}
	}
}
