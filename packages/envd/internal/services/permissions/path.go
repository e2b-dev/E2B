package permissions

import (
	"errors"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"slices"
)

func expand(path, homedir string) (string, error) {
	if len(path) == 0 {
		return path, nil
	}

	if path[0] != '~' {
		return path, nil
	}

	if len(path) > 1 && path[1] != '/' && path[1] != '\\' {
		return "", errors.New("cannot expand user-specific home dir")
	}

	return filepath.Join(homedir, path[1:]), nil
}

func ExpandAndResolve(path string, user *user.User) (string, error) {
	path, err := expand(path, user.HomeDir)
	if err != nil {
		return "", fmt.Errorf("failed to expand path '%s' for user '%s': %w", path, user.Username, err)
	}

	if filepath.IsAbs(path) {
		return path, nil
	}

	// The filepath.Abs can correctly resolve paths like /home/user/../file
	path = filepath.Join(user.HomeDir, path)

	abs, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("failed to resolve path '%s' for user '%s' with home dir '%s': %w", path, user.Username, user.HomeDir, err)
	}

	return abs, nil
}

func getSubpaths(path string) (subpaths []string) {
	for {
		subpaths = append(subpaths, path)

		path = filepath.Dir(path)
		if path == "/" {
			break
		}
	}

	slices.Reverse(subpaths)

	return subpaths
}

func EnsureDirs(path string, uid, gid int) error {
	subpaths := getSubpaths(path)
	for _, subpath := range subpaths {
		info, err := os.Stat(subpath)
		if err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("failed to stat directory: %w", err)
		}

		if info != nil && !info.IsDir() {
			return fmt.Errorf("path is a file: %s", subpath)
		}

		if err := os.Mkdir(subpath, 0o755); err != nil {
			if !os.IsExist(err) {
				return fmt.Errorf("failed to create directory: %w", err)
			}
		}

		err = os.Chown(subpath, uid, gid)
		if err != nil {
			return fmt.Errorf("failed to chown directory: %w", err)
		}
	}

	return nil
}
