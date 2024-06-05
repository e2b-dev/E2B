package permissions

import (
	"fmt"
	"os/user"
	"strconv"

	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/permissions"
)

func GetUserIds(u *user.User) (uid, gid uint32, err error) {
	newUID, err := strconv.ParseUint(u.Uid, 10, 32)
	if err != nil {
		return 0, 0, fmt.Errorf("error parsing uid '%s': %w", u.Uid, err)
	}

	newGID, err := strconv.ParseUint(u.Gid, 10, 32)
	if err != nil {
		return 0, 0, fmt.Errorf("error parsing gid '%s': %w", u.Gid, err)
	}

	return uint32(newUID), uint32(newGID), nil
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
		return nil, fmt.Errorf("invalid input type %T", selector)
	}
}
