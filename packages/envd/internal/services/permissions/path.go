package permissions

import (
	"errors"
	"fmt"
	"os/user"
	"path/filepath"

	"connectrpc.com/connect"

	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/permissions"
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

func GetUser(selector *rpc.User) (u *user.User, err error) {
	switch selector.GetSelector().(type) {
	case *rpc.User_Username:
		u, err = user.Lookup(selector.GetUsername())
		if err != nil {
			return nil, fmt.Errorf("error looking up user '%s': %w", selector.GetUsername(), err)
		}

		return u, nil
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid input type %T", selector))
	}
}
