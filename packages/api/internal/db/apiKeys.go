package db

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/e2b-dev/api/packages/api/internal/db/models"
	"github.com/volatiletech/sqlboiler/v4/queries/qm"
)

type team struct {
	ID string `json:"team_id"`
}

func (db *DB) GetTeamID(apiKey string) (*team, error) {
	result, err := models.TeamAPIKeys(qm.Where("api_key = ?", apiKey)).One(db.Client)
	if err != nil {
		var jsonSyntaxErr *json.SyntaxError
		if errors.As(err, &jsonSyntaxErr) {
			fmt.Printf("syntax error at byte offset %d", jsonSyntaxErr.Offset)
		}

		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to get team from API key: %w", err)
	}

	return &team{result.TeamID}, nil
}

type user struct {
	ID string `json:"user_id"`
}

func (db *DB) GetUserID(accessToken string) (*user, error) {
	result, err := models.AccessTokens(qm.Where("access_token = ?", accessToken)).One(db.Client)
	if err != nil {
		var jsonSyntaxErr *json.SyntaxError
		if errors.As(err, &jsonSyntaxErr) {
			fmt.Printf("syntax error at byte offset %d", jsonSyntaxErr.Offset)
		}

		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to get user from access token: %w", err)
	}

	return &user{result.UserID}, nil
}
