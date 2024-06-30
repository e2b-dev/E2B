package permissions

import (
	"context"
	"fmt"
	"os/user"

	"connectrpc.com/authn"
	"connectrpc.com/connect"
)

func AuthenticateUsername(_ context.Context, req authn.Request) (any, error) {
	username, _, ok := req.BasicAuth()
	if !ok {
		return nil, nil
	}

	u, err := GetUser(username)
	if err != nil {
		return nil, authn.Errorf("invalid username: '%s'", username)
	}

	return u, nil
}

func GetAuthUser(ctx context.Context) (*user.User, error) {
	u, ok := authn.GetInfo(ctx).(*user.User)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("no user specified"))
	}

	return u, nil
}
