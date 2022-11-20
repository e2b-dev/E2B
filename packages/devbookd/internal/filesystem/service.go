package filesystem

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	fswatcher "github.com/devbookhq/devbook-api/packages/devbookd/internal/filesystem/watcher"
	"github.com/devbookhq/devbook-api/packages/devbookd/internal/subscriber"
	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

type FileInfoResponse struct {
	IsDir bool   `json:"isDir"`
	Name  string `json:"name"`
}

type Service struct {
	logger    *zap.SugaredLogger
	dwatcher  *fswatcher.DirWatcher
	watchSubs *subscriber.Manager
}

func NewService(logger *zap.SugaredLogger) (*Service, error) {
	dwatcher, err := fswatcher.NewDirWatcher(logger.Named("dirWatcher"))
	if err != nil {
		return nil, fmt.Errorf("failed to create new dir watcher")
	}

	s := &Service{
		logger:    logger,
		watchSubs: subscriber.NewManager("filesystem/watchSubs", logger.Named("subscriber.filesystem.watchSubs")),
		dwatcher:  dwatcher,
	}
	go s.dirWatcherLoop()
	return s, nil
}

func (s *Service) dirWatcherLoop() {
	for {
		select {
		case err, ok := <-s.dwatcher.Errors:
			if !ok {
				return
			}
			s.logger.Errorf(
				"received an error from fswatcher.Errors",
				"error", err,
			)
		case e, ok := <-s.dwatcher.Events:
			if !ok {
				return
			}

			parentPath := filepath.Dir(e.Path)
			subs := s.watchSubs.Get(parentPath)

			for _, sub := range subs {
				if err := sub.Notify(e); err != nil {
					s.logger.Errorf(
						"failed to notify fswatch subscriber",
						"subscriberTopic", sub.Topic,
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
func (s *Service) WatchDir(ctx context.Context, dirpath string) (*rpc.Subscription, error) {
	s.logger.Infow(
		"Subscribe to WatchDir",
		"path", dirpath,
	)

	sub, allUnsubscribed, err := s.watchSubs.Create(ctx, dirpath)
	if err != nil {
		s.logger.Errorw(
			"Failed to create a filesystem.watch subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	go func() {
		<-allUnsubscribed
		if err := s.dwatcher.Remove(dirpath); err != nil {
			s.logger.Errorf(
				"failed to remove path from dwatcher",
				"error", err,
			)
			return
		}
	}()

	if err := s.dwatcher.Add(dirpath); err != nil {
		s.logger.Errorf(
			"Failed to add path to dwatcher",
			"error", err,
		)
		return nil, err
	}

	return sub.Subscription, nil
}

func (s *Service) List(dirpath string) (*[]FileInfoResponse, error) {
	s.logger.Infow("List directory",
		"dirpath", dirpath,
	)

	files, err := os.ReadDir(dirpath)
	if err != nil {
		s.logger.Errorw("Failed to list files in a directory",
			"directoryPath", dirpath,
			"error", err,
		)
		return nil, fmt.Errorf("error listing files in '%s': %+v", dirpath, err)
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

func (s *Service) Remove(path string) error {
	s.logger.Infow("Remove file or a directory",
		"path", path,
	)

	if err := os.RemoveAll(path); err != nil {
		s.logger.Errorw("Failed to remove a file or a directory",
			"path", path,
			"error", err,
		)
		return fmt.Errorf("error removing file or directory '%s': %+v", path, err)
	}
	return nil
}

func (s *Service) Read(path string) (string, error) {
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

func (s *Service) Write(path string, content string) error {
	s.logger.Infow("Write file",
		"path", path,
	)

	if err := os.WriteFile(path, []byte(content), 0755); err != nil {
		s.logger.Errorw("Failed to write to a file",
			"path", path,
			"content", content,
			"error", err,
		)
		return fmt.Errorf("error writing to file '%s': %+v", path, err)
	}
	return nil
}

func (s *Service) MakeDir(dirpath string) error {
	s.logger.Infow("Make new directory",
		"dirpath", dirpath,
	)

	if err := os.MkdirAll(dirpath, 0755); err != nil {
		s.logger.Errorw("Failed to create a new directory",
			"dirpath", dirpath,
			"error", err,
		)
		return fmt.Errorf("error creating a new directory '%s': %+v", dirpath, err)
	}

	return nil
}
