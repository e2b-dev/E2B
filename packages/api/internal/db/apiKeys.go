package db

import (
	"context"
	"fmt"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/accesstoken"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/team"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/teamapikey"
	"github.com/google/uuid"
)

func (db *DB) GetTeamAuth(ctx context.Context, apiKey string) (*ent.Team, error) {
	result, err := db.
		Client.
		TeamAPIKey.
		Query().
		WithTeam().
		Where(teamapikey.ID(apiKey)).
		QueryTeam().
		Where(team.IsDefault(true)).
		WithTeamTier().
		Only(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to get team from API key: %w", err)

		fmt.Println(errMsg.Error())

		return nil, errMsg
	}
	//
	if result.IsBlocked {
		errMsg := fmt.Errorf("team is blocked")

		return nil, errMsg
	}
	//
	return result, nil
}

func (db *DB) GetUserID(ctx context.Context, token string) (*uuid.UUID, error) {
	result, err := db.
		Client.
		AccessToken.
		Query().
		Where(accesstoken.ID(token)).
		Only(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to get user from access token: %w", err)

		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	return &result.UserID, nil
}
