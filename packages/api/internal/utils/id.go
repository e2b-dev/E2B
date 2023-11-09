package utils

import (
	"strings"

	"github.com/dchest/uniuri"
)

var caseInsensitiveAlphabet = []byte("abcdefghijklmnopqrstuvwxyz1234567890")

func GenerateID() string {
	return uniuri.NewLenChars(uniuri.UUIDLen, caseInsensitiveAlphabet)
}

func CleanEnvID(envID string) string {
	return strings.ToLower(strings.TrimSpace(envID))
}
