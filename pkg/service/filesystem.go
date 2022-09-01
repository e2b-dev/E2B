package service

import (
	"fmt"
	"io/ioutil"
	"os"

	"go.uber.org/zap"
)

// TODO: I'm not really sure if we're using RPC Notifier and Subscriber in the right way.
// There isn't an explicit documentation, I'm using source code of tests as a reference:
// https://cs.github.com/ethereum/go-ethereum/blob/440c9fcf75d9d5383b72646a65d5e21fa7ab6a26/rpc/testservice_test.go#L160

type FileInfoResponse struct {
	IsDir bool   `json:"isDir"`
	Name  string `json:"name"`
}

type FilesystemService struct {
	logger *zap.SugaredLogger
}

func NewFilesystemService(logger *zap.SugaredLogger) *FilesystemService {
	fs := &FilesystemService{
		logger: logger,
	}
	return fs
}

func (fs *FilesystemService) ListAllFiles(path string) (*[]FileInfoResponse, error) {
	files, err := ioutil.ReadDir(path)
	if err != nil {
		fs.logger.Errorw("failed to list files in a directory",
			"directoryPath", path,
			"error", err,
		)
		return nil, fmt.Errorf("failed to list files in '%s': %+v", path, err)
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

func (fs *FilesystemService) RemoveFile(path string) error {
	if err := os.Remove(path); err != nil {
		fs.logger.Errorw("failed to remove a file",
			"filePath", path,
			"error", err,
		)
		return fmt.Errorf("failed to remove a file '%s': %+v", path, err)
	}
	return nil
}

func (fs *FilesystemService) WriteFile(path string, content string) error {
	if err := os.WriteFile(path, []byte(content), 0755); err != nil {
		fs.logger.Errorw("failed to write to a file",
			"filePath", path,
			"content", content,
			"error", err,
		)
		return fmt.Errorf("failed to write to the file '%s': %+v", path, err)
	}
	return nil
}

func (fs *FilesystemService) ReadFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		fs.logger.Errorw("failed to read a file",
			"filePath", path,
			"error", err,
		)
		return "", fmt.Errorf("failed to read a file '%s': %+v", path, err)
	}

	return string(data), nil
}
