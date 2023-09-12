package db

import (
	"encoding/json"
	"errors"
	"fmt"
)

const teamApiKeysTableName = "team_api_keys"
const accessTokenTableName = "access_tokens"

type team struct {
	ID string `json:"team_id"`
}

func (db *DB) GetTeamID(apiKey string) (*team, error) {
	var result team

	err := db.Client.
		From(teamApiKeysTableName).
		Select("team_id").
		Single().
		Eq("api_key", apiKey).
		Execute(&result)
	if err != nil {
		var jsonSyntaxErr *json.SyntaxError
		if errors.As(err, &jsonSyntaxErr) {
			fmt.Printf("syntax error at byte offset %d", jsonSyntaxErr.Offset)
		}

		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to get team from API key: %w", err)
	}

	return &result, nil
}

type user struct {
	ID string `json:"user_id"`
}

func (db *DB) GetUserID(accessToken string) (*user, error) {
	var result user

	err := db.Client.
		From(accessTokenTableName).
		Select("user_id").
		Single().
		Eq("access_token", accessToken).
		Execute(&result)
	if err != nil {
		var jsonSyntaxErr *json.SyntaxError
		if errors.As(err, &jsonSyntaxErr) {
			fmt.Printf("syntax error at byte offset %d", jsonSyntaxErr.Offset)
		}

		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to get user from access token: %w", err)
	}

	return &result, nil
}
