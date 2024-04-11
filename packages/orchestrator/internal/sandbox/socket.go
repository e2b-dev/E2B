package sandbox

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func getSocketPath(instanceID string) (string, error) {
	filename := strings.Join([]string{
		"firecracker-",
		instanceID,
		".socket",
	}, "")

	var dir string

	if checkExistsAndDir(os.TempDir()) {
		dir = os.TempDir()
	} else {
		errMsg := fmt.Errorf("unable to find a location for firecracker socket")
		return "", errMsg
	}

	return filepath.Join(dir, filename), nil
}

func checkExistsAndDir(path string) bool {
	if path == "" {
		return false
	}

	if info, err := os.Stat(path); err == nil {
		return info.IsDir()
	}

	return false
}
