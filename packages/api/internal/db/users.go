package db

import (
	"fmt"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/team"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/user"
	"github.com/google/uuid"
)

func (db *DB) GetDefaultTeamFromUserID(userID string) (teamID string, err error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return "", fmt.Errorf("failed to parse userID: %w", err)
	}

	t, err := db.Client.Team.Query().Select(team.FieldID).Where(team.IsDefaultEQ(true), team.HasUsersWith(user.ID(userUUID))).Only(db.ctx)

	if err != nil {
		errMsg := fmt.Errorf("failed to get default team from user: %w", err)
		fmt.Println(errMsg.Error())

		return "", errMsg
	}

	return t.ID.String(), nil
}
