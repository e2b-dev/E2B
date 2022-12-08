package supabase

import (
	"encoding/json"
	"fmt"

	"github.com/devbookhq/devbook-api/packages/api/internal/api"
	"github.com/rs/xid"
)

func (db *DB) UpdateEnvStateCodeSnippet(codeSnippetID string, state api.EnvironmentState) error {
	body := map[string]interface{}{"state": state}
	err := db.Client.
		From("envs").
		Update(&body).
		Eq("code_snippet_id", codeSnippetID).
		Execute(nil)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return fmt.Errorf("failed to update env state for code snippet '%s': %s", codeSnippetID, err)
	}

	return nil
}

func (db *DB) DeleteEnv(codeSnippetID string) error {
	err := db.Client.
		From("envs").
		Delete().
		Eq("code_snippet_id", codeSnippetID).
		Execute(nil)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return fmt.Errorf("failed to delete env '%s': %s", codeSnippetID, err)
	}

	return nil
}

type newEnv struct {
	OwnerID  string `json:"owner_id"`
	Template string `json:"template"`
	ID       string `json:"id"`
}

func (db *DB) CreateEnv(userID, template string) (string, error) {
	id := "env_" + xid.New().String()

	body := newEnv{
		ID:       id,
		OwnerID:  userID,
		Template: template,
	}
	err := db.Client.
		From("envs").
		Insert(&body).
		Execute(nil)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return "", fmt.Errorf("failed to create env for userID '%s' with template '%s': %s", userID, template, err)
	}

	return id, nil
}
