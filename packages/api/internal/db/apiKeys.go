package db

import (
	"encoding/json"
	"errors"
	"fmt"
)

const teamApiKeysTableName = "team_api_keys"

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
