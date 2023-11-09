package db

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/api/internal/db/ent"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/team"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/user"

	"github.com/google/uuid"
)

func (db *DB) GetDefaultTeamFromUserID(ctx context.Context, userID string) (teamID string, err error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return "", fmt.Errorf("failed to parse userID: %w", err)
	}

	t, err := db.
		Client.
		Team.
		Query().
		Select(team.FieldID).
		Where(team.IsDefaultEQ(true), team.HasUsersWith(user.ID(userUUID))).
		Only(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to get default team from user: %w", err)
		fmt.Println(errMsg.Error())

		return "", errMsg
	}

	return t.ID.String(), nil
}

func (db *DB) GetDefaultTeamAndTierFromUserID(ctx context.Context, userID string) (*ent.Team, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to parse userID: %w", err)
	}

	t, err := db.
		Client.
		Team.
		Query().
		Select(team.FieldID).
		Where(team.IsDefaultEQ(true), team.HasUsersWith(user.ID(userUUID))).
		WithTeamTier().
		Only(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to get default team from user: %w", err)
		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	return t, nil
}
