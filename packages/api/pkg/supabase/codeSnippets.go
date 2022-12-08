package supabase

import (
	"encoding/json"
	"fmt"

	"github.com/rs/xid"
)

type codeSnippet struct {
	Title    string `json:"title"`
	Template string `json:"template"`
	ID       string `json:"id"`
}

func (db *DB) GetCodeSnippets(userID string) (*[]codeSnippet, error) {
	var result []codeSnippet

	err := db.Client.
		From("code_snippets").
		Select("id", "template", "title").
		Eq("creator_id", userID).
		Execute(&result)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return nil, fmt.Errorf("failed to get code snippets for user '%s': %s", userID, err)
	}

	return &result, nil
}

func (db *DB) DeleteCodeSnippet(codeSnippetID string) error {
	err := db.Client.
		From("code_snippet").
		Delete().
		Eq("id", codeSnippetID).
		Execute(nil)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return fmt.Errorf("failed to delete code snippet '%s': %s", codeSnippetID, err)
	}

	return nil
}

type newCodeSnippet struct {
	CreatorID string `json:"creator_id"`
	Template  string `json:"template"`
	ID        string `json:"id"`
}

func (db *DB) CreateCodeSnippet(userID, template string) (string, error) {
	id := "cs_" + xid.New().String()

	body := newCodeSnippet{
		ID:        id,
		CreatorID: userID,
		Template:  template,
	}
	err := db.Client.
		From("code_snippets").
		Insert(&body).
		Execute(nil)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return "", fmt.Errorf("failed to create code snippet for userID '%s' with template '%s': %s", userID, template, err)
	}

	return id, nil
}
