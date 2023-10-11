package db

import (
	"fmt"
	"github.com/volatiletech/sqlboiler/v4/queries/qm"

	"github.com/e2b-dev/infra/packages/api/internal/db/models"
)

type team struct {
	ID string `json:"team_id"`
}

func (db *DB) GetTeamID(apiKey string) (*team, error) {
	joinTeam := qm.InnerJoin(models.TableNames.Teams + " on " + models.TableNames.TeamAPIKeys + "." + models.TeamAPIKeyColumns.TeamID + " = " + models.TableNames.Teams + "." + models.TeamColumns.ID)
	result, err := models.TeamAPIKeys(qm.Load(models.TeamAPIKeyRels.Team), models.TeamAPIKeyWhere.APIKey.EQ(apiKey), joinTeam).One(db.Client)
	if err != nil {
		errMsg := fmt.Errorf("failed to get team from API key: %w", err)

		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	if result.R.Team.IsBlocked {
		errMsg := fmt.Errorf("team is blocked")
		return nil, errMsg
	}

	return &team{result.TeamID}, nil
}

type user struct {
	ID string `json:"user_id"`
}

func (db *DB) GetUserID(accessToken string) (*user, error) {
	result, err := models.AccessTokens(models.AccessTokenWhere.AccessToken.EQ(accessToken)).One(db.Client)
	if err != nil {
		errMsg := fmt.Errorf("failed to get user from access token: %w", err)

		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	return &user{result.UserID}, nil
}
