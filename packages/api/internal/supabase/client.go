package supabase

import (
	"os"

	"fmt"
	"net/url"

	postgrest "github.com/nedpals/postgrest-go/pkg"
)

type DB struct {
	Client *postgrest.Client
}

func NewClient() (*DB, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
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

	return &DB{
		Client: client,
	}, nil
}

func (db *DB) Close() {
	db.Client.CloseIdleConnections()
}
