package supabase

import (
	"encoding/json"
	"fmt"

	"github.com/devbookhq/devbook-api/packages/api/internal/nomad"
)

const codeSnippetsTableName = "code_snippets"

type codeSnippet struct {
	Title    string `json:"title"`
	Template string `json:"template"`
	ID       string `json:"id"`
}

func (db *DB) GetCodeSnippets(userID string) (*[]codeSnippet, error) {
	var result []codeSnippet

	err := db.Client.
		From(codeSnippetsTableName).
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
		From(codeSnippetsTableName).
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
	CreatorID string  `json:"creator_id"`
	Template  string  `json:"template"`
	Title     *string `json:"title"`
	ID        string  `json:"id"`
}

func (db *DB) CreateCodeSnippet(userID, template string, title *string) (*newCodeSnippet, error) {
	id := nomad.GenRandomID(12)

	body := newCodeSnippet{
		ID:        id,
		CreatorID: userID,
		Template:  template,
		Title:     title,
	}
	err := db.Client.
		From(codeSnippetsTableName).
		Insert(&body).
		Execute(nil)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return nil, fmt.Errorf("failed to create code snippet for userID '%s' with template '%s': %s", userID, template, err)
	}

	return &body, nil
}

func (db *DB) UpdateTitleCodeSnippet(codeSnippetID string, title *string) error {
	body := map[string]interface{}{"title": title}
	err := db.Client.
		From(codeSnippetsTableName).
		Update(&body).
		Eq("id", codeSnippetID).
		Execute(nil)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return fmt.Errorf("failed to update code snippet title '%s': %s", codeSnippetID, err)
	}

	return nil
}
