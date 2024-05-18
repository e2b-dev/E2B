package filesystem

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"syscall"

	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1"
	specconnect "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1/filesystemv1connect"

	"connectrpc.com/connect"
	"github.com/fsnotify/fsnotify"
)

type Service struct {
	specconnect.UnimplementedFilesystemServiceHandler
}

func Handle(server *http.ServeMux, opts ...connect.HandlerOption) {
	path, handler := specconnect.NewFilesystemServiceHandler(Service{}, opts...)

	server.Handle(path, handler)
}

func (Service) Stat(ctx context.Context, req *connect.Request[v1.StatRequest]) (*connect.Response[v1.StatResponse], error) {
	filePath := req.Msg.GetPath()

	fileInfo, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("file not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error statting file: %w", err))
	}

	var t v1.FileType
	if fileInfo.IsDir() {
		t = v1.FileType_FILE_TYPE_DIRECTORY
	} else {
		t = v1.FileType_FILE_TYPE_FILE
	}

	response := &v1.StatResponse{
		Entry: &v1.EntryInfo{
			Name: fileInfo.Name(),
			Type: t,
		},
	}

	return connect.NewResponse(response), nil
}

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

func (Service) Watch(ctx context.Context, req *connect.Request[v1.WatchRequest], stream *connect.ServerStream[v1.WatchResponse]) error {
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
			return connect.NewError(connect.CodeCanceled, fmt.Errorf("context done: %w", ctx.Err()))
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
			ops := []v1.EventType{}

			if fsnotify.Create.Has(e.Op) {
				ops = append(ops, v1.EventType_EVENT_TYPE_CREATE)
			}

			if fsnotify.Rename.Has(e.Op) {
				ops = append(ops, v1.EventType_EVENT_TYPE_RENAME)
			}

			if fsnotify.Chmod.Has(e.Op) {
				ops = append(ops, v1.EventType_EVENT_TYPE_CHMOD)
			}

			if fsnotify.Write.Has(e.Op) {
				ops = append(ops, v1.EventType_EVENT_TYPE_WRITE)
			}

			if fsnotify.Remove.Has(e.Op) {
				ops = append(ops, v1.EventType_EVENT_TYPE_REMOVE)
			}

			for _, op := range ops {
				streamErr := stream.Send(&v1.WatchResponse{
					Event: &v1.FilesystemEvent{
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

func (Service) Copy(ctx context.Context, req *connect.Request[v1.CopyRequest]) (*connect.Response[v1.CopyResponse], error) {
	source := req.Msg.GetSource()
	destination := req.Msg.GetDestination()

	fileInfo, err := os.Stat(source)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("source not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error statting source file: %w", err))
	}

	mode, err := permissions.GetMode(req.Msg.GetMode())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid mode: %w", err))
	}

	if fileInfo.IsDir() {
		err = CopyDirectory(source, destination, mode)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error copying directory: %w", err))
		}
	} else {
		err = Copy(source, destination)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error copying file: %w", err))
		}

		stat, ok := fileInfo.Sys().(*syscall.Stat_t)
		if !ok {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to get raw syscall.Stat_t data for '%s'", source))
		}

		err = os.Chown(destination, int(stat.Uid), int(stat.Gid))
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error setting owner: %w", err))
		}
	}

	return connect.NewResponse(&v1.CopyResponse{}), nil
}
