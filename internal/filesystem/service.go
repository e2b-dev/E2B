package filesystem

import (
	"fmt"
	"os"

	"go.uber.org/zap"
)

type FileInfoResponse struct {
	IsDir bool   `json:"isDir"`
	Name  string `json:"name"`
}

type Service struct {
	logger *zap.SugaredLogger
}

func NewService(logger *zap.SugaredLogger) *Service {
	return &Service{
		logger: logger,
	}
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
