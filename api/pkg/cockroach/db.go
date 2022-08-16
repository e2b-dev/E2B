package cockroach

import (
	"context"
	"fmt"
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
	_, err := c.pool.Exec(
		ctx,
		fmt.Sprintf("CREATE DATABASE %s", id),
	)

	if err != nil {
		return "", err
	}
	return databaseURL(id), nil
}
