package permissions

import (
	"fmt"
	"os/user"
	"strconv"
)

func GetUserByUsername(username string) (u *user.User, uid, gid uint32, err error) {
	u, err = user.Lookup(username)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("error looking up user '%s': %w", username, err)
	}

	newUID, err := strconv.ParseUint(u.Uid, 10, 32)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("error parsing uid '%s': %w", u.Uid, err)
	}

	newGID, err := strconv.ParseUint(u.Gid, 10, 32)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("error parsing gid '%s': %w", u.Gid, err)
	}

	return u, uint32(newUID), uint32(newGID), nil
}
