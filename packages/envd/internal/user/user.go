package user

import (
	"os/user"
	"strconv"
)

const DefaultUser = "user"

func GetUser(name string) (uid, gid int64, homedir, username string, err error) {
	var u *user.User

	if name == "" {
		u, err = user.Current()
		if err != nil {
			return uid, gid, homedir, username, err
		}
	} else {
		u, err = user.Lookup(name)
		if err != nil {
			return uid, gid, homedir, username, err
		}
	}

	uid, err = strconv.ParseInt(u.Uid, 10, 32)
	if err != nil {
		return uid, gid, homedir, username, err
	}

	gid, err = strconv.ParseInt(u.Gid, 10, 32)
	if err != nil {
		return uid, gid, homedir, username, err
	}

	return uid, gid, u.HomeDir, u.Username, nil
}
