package filesystem

import (
	"fmt"
	"os"
)

func GetMissingDirectories(path string, perm os.FileMode) (paths []string, err error) {
	for i := len(path); i > 0; i-- {
		if os.IsPathSeparator(path[i]) {
			dir, statErr := os.Stat(path)
			if statErr == nil {
				if dir.IsDir() {
					return paths, nil
				}

				return nil, fmt.Errorf("file in the directory path")
			}

			paths = append([]string{path[:i]}, paths...)
		}
	}

	return nil, fmt.Errorf("path is not absolute")
}
