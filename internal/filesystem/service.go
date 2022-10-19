package filesystem

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	fsevent "github.com/devbookhq/devbookd/internal/filesystem/event"
	"github.com/devbookhq/devbookd/internal/subscriber"
	"github.com/ethereum/go-ethereum/rpc"
	"github.com/fsnotify/fsnotify"
	"go.uber.org/zap"
)

type FileInfoResponse struct {
	IsDir bool   `json:"isDir"`
	Name  string `json:"name"`
}

type Service struct {
	logger    *zap.SugaredLogger
	fswatcher *fsnotify.Watcher
	watchSubs *subscriber.Manager
}

func NewService(logger *zap.SugaredLogger) (*Service, error) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	s := &Service{
		logger:    logger,
		fswatcher: w,
		watchSubs: subscriber.NewManager("filesystem/watchSubs", logger.Named("subscriber.filesystem.watchSubs")),
	}
	go s.fswatcherLoop()
	return s, nil
}

func (s *Service) fswatcherLoop() {
	for {
		select {
		case err, ok := <-s.fswatcher.Errors:
			if !ok {
				// Channel was closed (i.e. Watcher.Close() was called).
				return
			}
			s.logger.Errorf(
				"received an error from fswatcher.Errors",
				"error", err,
			)
		case e, ok := <-s.fswatcher.Events:
			if !ok {
				// Channel was closed (i.e. Watcher.Close() was called).
				return
			}

			msg, err := fsevent.NewEventMessage(e)
			if err != nil {
				s.logger.Errorf(
					"failed to create new fsevent message",
					"error", err,
				)
				continue
			}

			// We need to do two retrievals from the watchSubs map because
			// there might be subscribers that are watching for the changes
			// of the parent directory.
			subs := s.watchSubs.GetByID(e.Name)
			dirpath := filepath.Dir(e.Name)
			subs = append(subs, s.watchSubs.GetByID(dirpath)...)

			s.logger.Debugw("fswatcher event",
				"path", e.Name,
				"op", e.Op.String(),
				"len(subs)", len(subs),
			)

			for _, sub := range subs {
				if err := sub.Notify(msg); err != nil {
					s.logger.Errorf(
						"failed to notify fswatch subscriber",
						"subscriberTopic", sub.ID,
						"subscriptionID", sub.Subscription.ID,
						"error", err,
					)
					continue
				}
			}
		}
	}
}

// Subscription
func (s *Service) Watch(ctx context.Context, path string) (*rpc.Subscription, error) {
	// We never watch individual files.
	// Watching individual files is problematic, see https://pkg.go.dev/github.com/fsnotify/fsnotify#hdr-Watching_files.
	// Instead, we check if the `path` is a path to a dir or to a file.
	// If it's a dir, we proceed as expected as start watching that dir.
	// If the path is a file, we get a parent dir of this file and start watching the parent dir.
	//
	// Knowing the above, the first question that comes to mind is how do we then make sure that subscribers that
	// want to subscribe to changes to a file are able to get notified if we watch only the parent dir and not the file itself?
	// When we create a new watch subscriber via `watchSubs.Add()` we pass the `path` as the subscriber's topic.
	// This path is the original path (so it's either path to a file or path to a dir).
	// Then when `fsnotify.Events` emits a new event (this is handled in the `fswatcherLoop` function),
	// the fsnotify.Event contains a path associated with the filesystem operation.
	// We use this event path to get all subscribers that subscribed to this path or to a parent path (dir).

	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("path '%s' doesn't exist. Can't watch files and dirs that don't exist", path)
	}

	s.logger.Infow(
		"Subscribe to Watch",
		"path", path,
	)

	stat, err := os.Stat(path)
	if err != nil {
		s.logger.Errorw("Failed to stat path",
			"path", path,
			"error", err,
		)
		return nil, fmt.Errorf("failed to stat path '%s': %s", path, err)
	}

	var dirpath string
	if stat.IsDir() {
		dirpath = path
	} else {
		dirpath = filepath.Dir(path)
	}

	sub, lastUnsubscribed, err := s.watchSubs.Add(ctx, path)
	if err != nil {
		s.logger.Errorw("Failed to create an filesystem.watch subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	go func() {
		<-lastUnsubscribed

		s.logger.Debugw(
			"will remove path from watchList",
			"path", path,
			"watchList", s.fswatcher.WatchList(),
		)

		// We can safely ignore errors that originated from trying to remove a path that isn't watched anymore.
		if err := s.fswatcher.Remove(path); err != nil && err != fsnotify.ErrNonExistentWatch {
			s.logger.Errorf(
				"failed to remove path from fswatcher",
				"watchList", s.fswatcher.WatchList(),
				"error", err,
			)
			return
		}

		s.logger.Debugw(
			"successfuly removed path from watchList",
			"path", path,
			"watchList", s.fswatcher.WatchList(),
		)
	}()

	paths := s.fswatcher.WatchList()
	watching := false
	for _, p := range paths {
		if p == dirpath {
			watching = true
			s.logger.Debugw(
				"The path is already being watched",
				"path", path,
			)
			break
		}
	}

	if !watching {
		s.logger.Debugw("Adding dirpath to fswatcher", "dirpath", dirpath)
		if err := s.fswatcher.Add(dirpath); err != nil {
			s.logger.Errorw("Failed to add path to fswatcher",
				"path", dirpath,
				"error", err,
			)
			return nil, fmt.Errorf("failed to watch path '%s': %s", dirpath, err)
		}
	}

	return sub.Subscription, nil
}

func (s *Service) ListAllFiles(path string) (*[]FileInfoResponse, error) {
	s.logger.Infow("List all files",
		"path", path,
	)

	files, err := os.ReadDir(path)
	if err != nil {
		s.logger.Errorw("Failed to list files in a directory",
			"directoryPath", path,
			"error", err,
		)
		return nil, fmt.Errorf("error listing files in '%s': %+v", path, err)
	}

	results := []FileInfoResponse{}

	for _, file := range files {
		results = append(results, FileInfoResponse{
			IsDir: file.IsDir(),
			Name:  file.Name(),
		})
	}

	return &results, nil
}

func (s *Service) RemoveFile(path string) error {
	s.logger.Infow("Remove file",
		"path", path,
	)

	if err := os.Remove(path); err != nil {
		s.logger.Errorw("Failed to remove a file",
			"filePath", path,
			"error", err,
		)
		return fmt.Errorf("error removing file '%s': %+v", path, err)
	}
	return nil
}

func (s *Service) WriteFile(path string, content string) error {
	s.logger.Infow("Write file",
		"path", path,
	)

	if err := os.WriteFile(path, []byte(content), 0755); err != nil {
		s.logger.Errorw("Failed to write to a file",
			"filePath", path,
			"content", content,
			"error", err,
		)
		return fmt.Errorf("error writing to file '%s': %+v", path, err)
	}
	return nil
}

func (s *Service) ReadFile(path string) (string, error) {
	s.logger.Infow("Read file",
		"path", path,
	)

	data, err := os.ReadFile(path)
	if err != nil {
		s.logger.Errorw("Failed to read a file",
			"path", path,
			"error", err,
		)
		return "", fmt.Errorf("error reading file '%s': %+v", path, err)
	}

	return string(data), nil
}
