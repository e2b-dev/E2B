package supabase

import (
	"encoding/json"
	"fmt"
)

const publishedCodeSnippetsTableName = "published_code_snippets"

func (db *DB) DeletePublishedCodeSnippet(codeSnippetID string) error {
	err := db.Client.
		From(publishedCodeSnippetsTableName).
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

type publishedCodeSnippet struct {
	ID string `json:"id"`
}

func (db *DB) GetPublishedCodeSnippet(codeSnippetID string) (*publishedCodeSnippet, error) {
	body := publishedCodeSnippet{}

	err := db.Client.
		From(publishedCodeSnippetsTableName).
		Select("id").
		Single().
		Eq("code_snippet_id", codeSnippetID).
		Execute(&body)

	if err != nil {
		if e, ok := err.(*json.SyntaxError); ok {
			fmt.Printf("syntax error at byte offset %d", e.Offset)
		}
		fmt.Printf("error: %v\n", err)
		return nil, fmt.Errorf("failed to get published code snippet '%s': %s", codeSnippetID, err)
	}

	return &body, nil
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
		From(publishedCodeSnippetsTableName).
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
