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
	expanded, err := expand(path, user.HomeDir)
	if err != nil {
		return "", err
	}

	abs, err := filepath.Abs(expanded)
	if err != nil {
		return "", fmt.Errorf("failed to resolve path: %w", err)
	}

	return abs, nil
}
