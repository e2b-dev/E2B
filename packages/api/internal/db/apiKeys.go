package db

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/api/internal/db/ent/accesstoken"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/team"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/teamapikey"
)

func (db *DB) GetTeamID(ctx context.Context, apiKey string) (string, error) {
	result, err := db.
		Client.
		TeamAPIKey.
		Query().
		WithTeam().
		Where(teamapikey.ID(apiKey)).
		QueryTeam().
		Where(team.IsDefault(true)).
		Only(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to get team from API key: %w", err)

		fmt.Println(errMsg.Error())

		return "", errMsg
	}
	//
	if result.IsBlocked {
		errMsg := fmt.Errorf("team is blocked")

		return "", errMsg
	}
	//
	return result.ID.String(), nil
}

func (db *DB) GetUserID(ctx context.Context, token string) (string, error) {
	result, err := db.
		Client.
		AccessToken.
		Query().
		Where(accesstoken.ID(token)).
		Only(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to get user from access token: %w", err)

		fmt.Println(errMsg.Error())

		return "", errMsg
	}

	return result.UserID.String(), nil
}
