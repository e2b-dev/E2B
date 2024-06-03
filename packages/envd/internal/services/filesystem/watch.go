package filesystem

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem"

	"connectrpc.com/connect"
	"github.com/fsnotify/fsnotify"
)

func (Service) Watch(ctx context.Context, req *connect.Request[rpc.WatchRequest], stream *connect.ServerStream[rpc.WatchResponse]) error {
	watchPath := req.Msg.GetPath()

	info, err := os.Stat(watchPath)
	if err != nil && !os.IsNotExist(err) {
		return connect.NewError(connect.CodeInternal, fmt.Errorf("error statting path %s: %w", watchPath, err))
	}

	if os.IsNotExist(err) {
		watchPath = filepath.Dir(watchPath)

		info, err = os.Stat(watchPath)
		if err != nil {
			return connect.NewError(connect.CodeNotFound, fmt.Errorf("parent path %s not found: %w", watchPath, err))
		}

		if !info.IsDir() {
			return connect.NewError(connect.CodeNotFound, fmt.Errorf("parent path %s not a directory: %w", watchPath, err))
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
			err = ctx.Err()
			if err != nil {
				return connect.NewError(connect.CodeCanceled, fmt.Errorf("context done: %w", err))
			}

			return nil
		case chErr, ok := <-w.Errors:
			if !ok {
				return connect.NewError(connect.CodeInternal, fmt.Errorf("watcher not ok error: %w", chErr))
			}

			return connect.NewError(connect.CodeInternal, fmt.Errorf("watcher error: %w", err))
		case e, ok := <-w.Events:
			if !ok {
				return connect.NewError(connect.CodeInternal, fmt.Errorf("watcher event not ok error: %w", err))
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
					return connect.NewError(connect.CodeInternal, fmt.Errorf("error sending event: %w", streamErr))
				}
			}
		}
	}
}
