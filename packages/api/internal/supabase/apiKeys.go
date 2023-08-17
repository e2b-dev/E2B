package supabase

import (
	"encoding/json"
	"fmt"
)

// TODO: The API keys should be hashed
const apiKeysTableName = "api_keys"

type user struct {
	ID string `json:"owner_id"`
}

func (db *DB) GetUserID(apiKey string) (*user, error) {
	var result user

	err := db.Client.
		From(apiKeysTableName).
		Select("owner_id").
		Single().
		Eq("api_key", apiKey).
		Execute(&result)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return nil, fmt.Errorf("failed to get user from API key: %s", err)
	}

	return &result, nil
}

type team struct {
	ID string `json:"team_id"`
}

func (db *DB) GetTeamID(apiKey string) (*team, error) {
	var result team

	err := db.e2bClient.
		From("team_api_keys").
		Select("team_id").
		Single().
		Eq("api_key", apiKey).
		Execute(&result)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return nil, fmt.Errorf("failed to get team from API key: %s", err)
	}

	return &result, nil
}
