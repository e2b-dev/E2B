package auth

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"strings"

	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/accesstoken"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envbuild"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/user"
)

func Validate(ctx context.Context, db *models.Client, token, envID string) (bool, error) {
	u, err := db.User.Query().Where(user.HasAccessTokensWith(accesstoken.ID(token))).WithTeams().Only(ctx)
	if err != nil {
		return false, err
	}

	e, err := db.Env.Query().Where(
		env.ID(envID),
		env.HasBuildsWith(envbuild.StatusEQ(envbuild.StatusWaiting)),
	).Only(ctx)
	if err != nil {
		return false, err
	}

	for _, team := range u.Edges.Teams {
		if team.ID == e.TeamID {
			return true, nil
		}
	}

	return false, nil
}

func ValidateAccessToken(ctx context.Context, db *models.Client, accessToken string) bool {
	exists, err := db.AccessToken.Query().Where(accesstoken.ID(accessToken)).Exist(ctx)
	if err != nil {
		log.Printf("Error while checking access token: %s\n", err.Error())
		return false
	}

	return exists
}

func ExtractAccessToken(authHeader, authType string) (string, error) {
	encodedLoginInfo := strings.TrimSpace(strings.TrimPrefix(authHeader, authType))
	loginInfo, err := base64.StdEncoding.DecodeString(encodedLoginInfo)
	if err != nil {
		return "", fmt.Errorf("error while decoding login info for %s: %s", encodedLoginInfo, err)
	}

	loginInfoParts := strings.Split(string(loginInfo), ":")
	if len(loginInfoParts) != 2 {
		return "", fmt.Errorf("invalid login info format %s", string(loginInfo))
	}

	username := loginInfoParts[0]
	if username != "_e2b_access_token" {
		return "", fmt.Errorf("invalid username %s", username)
	}

	// There can be extra whitespace in the token when the user uses Windows
	return strings.TrimSpace(loginInfoParts[1]), nil
}
