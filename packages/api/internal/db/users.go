package db

import (
	"fmt"

	"github.com/volatiletech/null/v8"

	"github.com/e2b-dev/infra/packages/api/internal/db/models"
	"github.com/volatiletech/sqlboiler/v4/queries/qm"
)

func (db *DB) GetDefaultTeamFromUserID(userID string) (result *models.Team, err error) {
	userWhere := models.UsersTeamWhere.UserID.EQ(userID)
	defaultTeamWhere := models.TeamWhere.IsDefault.EQ(null.BoolFrom(true))
	joinTeam := qm.InnerJoin(models.TableNames.Teams + " on " + models.TableNames.UsersTeams + "." + models.UsersTeamColumns.TeamID + " = " + models.TableNames.Teams + "." + models.TeamColumns.ID)

	userTeam, err := models.UsersTeams(qm.Load(models.UsersTeamRels.Team), joinTeam, userWhere, defaultTeamWhere).One(db.Client)
	if err != nil {
		errMsg := fmt.Errorf("failed to list envs: %w", err)
		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	return userTeam.R.Team, nil
}
