package utils

import (
	"strings"
)

func ShortID(id string) string {
	parts := strings.Split(id, "-")

	if len(parts) == 2 {
		return parts[0]
	}

	return id
}
