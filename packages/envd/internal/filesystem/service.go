package filesystem

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"

	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"

	fswatcher "github.com/e2b-dev/infra/packages/envd/internal/filesystem/watcher"
	"github.com/e2b-dev/infra/packages/envd/internal/subscriber"
)

type FileInfoResponse struct {
	Name  string `json:"name"`
	IsDir bool   `json:"isDir"`
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
	s.logger.Debugw(
		"Subscribing to WatchDir",
		"path", dirpath,
	)

	sub, allUnsubscribed, err := s.watchSubs.Create(ctx, dirpath)
	if err != nil {
		s.logger.Errorw(
			"Failed to create a filesystem.watch subscription from context",
			"ctx", ctx,
			"error", err,
		)

		return nil, fmt.Errorf("error creating a filesystem.watch subscription from context: %w", err)
	}

	go func() {
		<-allUnsubscribed

		if removeErr := s.dwatcher.Remove(dirpath); removeErr != nil {
			s.logger.Errorf(
				"failed to remove path from dwatcher",
				"error", removeErr,
			)

			return
		}
	}()

	if addErr := s.dwatcher.Add(dirpath); addErr != nil {
		s.logger.Errorf(
			"Failed to add path to dwatcher",
			"error", addErr,
		)

		return nil, fmt.Errorf("error adding path to dwatcher: %w", addErr)
	}

	s.logger.Debugw(
		"Subscribed to WatchDir",
		"path", dirpath,
		"subID", sub.Subscription.ID,
	)

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

		return nil, fmt.Errorf("error listing files in '%s': %w", dirpath, err)
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

		return fmt.Errorf("error removing file or directory '%s': %w", path, err)
	}

	return nil
}

// Method used for reading UTF-8 data from files.
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

		return "", fmt.Errorf("error reading file '%s': %w", path, err)
	}

	return string(data), nil
}

// We need to handle non-utf8 data, so we encode the data to base64.
// This can be used to transfer binary data and data incompatible with utf-8.
func (s *Service) ReadBase64(path string) (string, error) {
	s.logger.Infow("Read file and encode to base64",
		"path", path,
	)

	data, err := os.ReadFile(path)
	if err != nil {
		s.logger.Errorw("Failed to read a file",
			"path", path,
			"error", err,
		)

		return "", fmt.Errorf("error reading file '%s': %w", path, err)
	}

	content := base64.StdEncoding.EncodeToString(data)

	return content, nil
}

// Because the []byte(content) is representing each char in content as utf-8 bytes we cannot use this to transfer non-utf8 data.
func (s *Service) Write(path string, content string) error {
	s.logger.Infow("Write file",
		"path", path,
		"content", content,
	)

	if err := os.WriteFile(path, []byte(content), 0o755); err != nil {
		s.logger.Errorw("Failed to write to a file",
			"path", path,
			"content", content,
			"error", err,
		)

		return fmt.Errorf("error writing to file '%s': %w", path, err)
	}

	return nil
}

// Use this method if you need to transfer non-utf8 data.
// You need to encode the data to base64 before sending it to this method.
func (s *Service) WriteBase64(path string, content string) error {
	s.logger.Infow("Decode bytes from base64 and write them to file",
		"path", path,
		"content", content,
	)

	bytes, err := base64.StdEncoding.DecodeString(content)
	if err != nil {
		s.logger.Errorw("Failed to decode bytes from base64",
			"content", content,
			"error", err,
		)

		return fmt.Errorf("error decoding bytes from base64 '%s': %w", bytes, err)
	}

	if err := os.WriteFile(path, bytes, 0o755); err != nil {
		s.logger.Errorw("Failed to write to a file",
			"path", path,
			"content", content,
			"error", err,
		)

		return fmt.Errorf("error writing to file '%s': %w", path, err)
	}

	return nil
}

func (s *Service) MakeDir(dirpath string) error {
	s.logger.Infow("Make new directory",
		"dirpath", dirpath,
	)

	if err := os.MkdirAll(dirpath, 0o755); err != nil {
		s.logger.Errorw("Failed to create a new directory",
			"dirpath", dirpath,
			"error", err,
		)

		return fmt.Errorf("error creating a new directory '%s': %w", dirpath, err)
	}

	return nil
}
