package supabase

import (
	"encoding/json"
	"fmt"

	"github.com/devbookhq/devbook-api/packages/api/internal/api"
)

func UpdateEnvState(client *Client, codeSnippetID string, state api.EnvironmentState) error {
	body := map[string]interface{}{"state": state}
	err := client.DB.
		From("envs").
		Update(body).
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
