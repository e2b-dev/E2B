package db

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/api/internal/db/ent"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/team"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/user"

	"github.com/google/uuid"
)

func (db *DB) GetDefaultTeamFromUserID(ctx context.Context, userID uuid.UUID) (t *ent.Team, err error) {
	t, err = db.
		Client.
		Team.
		Query().
		Select(team.FieldID).
		Where(team.IsDefaultEQ(true), team.HasUsersWith(user.ID(userID))).
		Only(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to get default team from user: %w", err)
		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	return t, nil
}

func (db *DB) GetDefaultTeamAndTierFromUserID(ctx context.Context, userID uuid.UUID) (*ent.Team, error) {
	t, err := db.
		Client.
		Team.
		Query().
		Select(team.FieldID).
		Where(team.IsDefaultEQ(true), team.HasUsersWith(user.ID(userID))).
		WithTeamTier().
		Only(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to get default team from user: %w", err)
		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	return t, nil
}

func (db *DB) GetTeam(ctx context.Context, teamID uuid.UUID) (*ent.Team, error) {
	t, err := db.
		Client.
		Team.
		Query().
		Where(team.ID(teamID)).
		Only(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to get team: %w", err)
		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	return t, nil
}
