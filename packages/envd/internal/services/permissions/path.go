package permissions

import (
	"errors"
	"fmt"
	"os/user"
	"path/filepath"
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
