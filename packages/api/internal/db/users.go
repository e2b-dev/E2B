package db

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/volatiletech/null/v8"

	"github.com/e2b-dev/api/packages/api/internal/db/models"
	"github.com/volatiletech/sqlboiler/v4/queries/qm"
)

func (db *DB) GetDefaultTeamFromUserID(userID string) (result *models.Team, err error) {
	userWhere := models.UsersTeamWhere.UserID.EQ(userID)
	defaultTeamWhere := models.TeamWhere.IsDefault.EQ(null.BoolFrom(true))
	joinTeam := qm.InnerJoin(models.TableNames.Teams + " on " + models.TableNames.UsersTeams + "." + models.UsersTeamColumns.TeamID + " = " + models.TableNames.Teams + "." + models.TeamColumns.ID)
	userTeam, err := models.UsersTeams(joinTeam, userWhere, defaultTeamWhere).One(db.Client)

	if err != nil {
		var jsonSyntaxErr *json.SyntaxError
		if errors.As(err, &jsonSyntaxErr) {
			fmt.Printf("syntax error at byte offset %d", jsonSyntaxErr.Offset)
		}

		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to list envs: %w", err)
	}
	result = userTeam.R.Team
	return result, nil
}
