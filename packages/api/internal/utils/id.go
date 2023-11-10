package utils

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/dchest/uniuri"
)

var caseInsensitiveAlphabet = []byte("abcdefghijklmnopqrstuvwxyz1234567890")

func GenerateID() string {
	return uniuri.NewLenChars(uniuri.UUIDLen, caseInsensitiveAlphabet)
}

func CleanEnvID(envID string) (string, error) {
	cleanedEnvID := strings.ToLower(strings.TrimSpace(envID))
	ok, err := regexp.MatchString("^[a-z0-9-_]+$", cleanedEnvID)
	if err != nil {
		return "", err
	}

	if !ok {
		return "", fmt.Errorf("invalid env ID: %s", envID)
	}

	return cleanedEnvID, nil
}
