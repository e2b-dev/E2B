package cockroach

import (
	"context"
	"fmt"
	"log"
	"math/rand"
)

var idAlphabet = []rune("abcdefghijklmnopqrstuvwxyz1234567890")

func genRandomID(length int) string {
	b := make([]rune, length)
	for i := range b {
		b[i] = idAlphabet[rand.Intn(len(idAlphabet))]
	}
	return string(b)
}

func (c *Client) CreateDatabase(ctx context.Context) (string, error) {
	id := genRandomID(8)
	log.Printf("New database ID: %s\n", id)

	query := fmt.Sprintf("CREATE DATABASE %s;", id)
	log.Printf("New database SQL query: '%s'\n", query)

	_, err := c.pool.Exec(
		ctx,
		query,
	)

	if err != nil {
		return "", err
	}
	return databaseURL(id), nil
}
