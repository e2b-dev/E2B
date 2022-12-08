package supabase

import (
	"encoding/json"
	"fmt"
)

func (db *DB) DeletePublishedCodeSnippet(codeSnippetID string) error {
	err := db.Client.
		From("published_code_snippets").
		Delete().
		Eq("code_snippet_id", codeSnippetID).
		Execute(nil)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return fmt.Errorf("failed to delete published code snippet '%s': %s", codeSnippetID, err)
	}

	return nil
}

type newPublishedCodeSnippet struct {
	Template      string `json:"template"`
	CodeSnippetID string `json:"code_snippet_id"`
}

func (db *DB) UpsertPublishedCodeSnippet(codeSnippetID string) error {
	body := newPublishedCodeSnippet{
		CodeSnippetID: codeSnippetID,
	}

	err := db.Client.
		From("published_code_snippets").
		Upsert(&body).
		Execute(nil)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return fmt.Errorf("failed to create published code snippet '%s': %s", codeSnippetID, err)
	}

	return nil
}
