package supabase

import (
	"encoding/json"
	"fmt"
)

type user struct {
	ID string `json:"owner_id"`
}

func (db *DB) GetUserID(apiKey string) (*user, error) {
	var result user

	err := db.Client.
		From("api_keys").
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
