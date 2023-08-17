package supabase

import (
	"os"

	"fmt"
	"net/url"

	postgrest "github.com/nedpals/postgrest-go/pkg"
)

type DB struct {
	Client    *postgrest.Client
	e2bClient *postgrest.Client
}

func NewClient() (*DB, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	e2bsupabaseURL := os.Getenv("E2B_SUPABASE_URL")
	e2bsupabaseKey := os.Getenv("E2B_SUPABASE_KEY")

	parsedURL, err := url.Parse(supabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Supabase URL '%s': %s", supabaseURL, err)
	}

	client := postgrest.NewClient(
		*parsedURL,
		postgrest.WithTokenAuth(supabaseKey),
		func(c *postgrest.Client) {
			c.AddHeader("apikey", supabaseKey)
		},
	)
	e2bParsedURL, err := url.Parse(e2bsupabaseURL)

	e2bClient := postgrest.NewClient(
		*e2bParsedURL,
		postgrest.WithTokenAuth(e2bsupabaseKey),
		func(c *postgrest.Client) {
			c.AddHeader("apikey", e2bsupabaseKey)
		},
	)

	return &DB{
		Client:    client,
		e2bClient: e2bClient,
	}, nil
}

func (db *DB) Close() {
	db.Client.CloseIdleConnections()
}
