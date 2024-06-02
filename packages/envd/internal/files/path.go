package files

import (
	"errors"
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

	return filepath.Abs(expanded)
}
