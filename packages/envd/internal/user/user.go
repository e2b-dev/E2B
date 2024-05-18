package user

import (
	"fmt"
	"os/user"
	"strconv"
)

func GetUser(name string) (uid, gid int64, homedir, username string, err error) {
	var u *user.User

	if name == "" {
		u, err = user.Current()
		if err != nil {
			return uid, gid, homedir, username, fmt.Errorf("failed to get current user: %w", err)
		}
	} else {
		u, err = user.Lookup(name)
		if err != nil {
			return uid, gid, homedir, username, fmt.Errorf("failed to lookup user '%s': %w", name, err)
		}
	}

	parsedUID, err := strconv.ParseInt(u.Uid, 10, 32)
	if err != nil {
		return uid, gid, homedir, username, fmt.Errorf("failed to parse UID '%s': %w", u.Uid, err)
	}

	parsedGID, err := strconv.ParseInt(u.Gid, 10, 32)
	if err != nil {
		return uid, gid, homedir, username, fmt.Errorf("failed to parse GID '%s': %w", u.Gid, err)
	}

	return parsedUID, parsedGID, u.HomeDir, u.Username, nil
}
