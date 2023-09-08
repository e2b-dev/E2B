package utils

import (
	"github.com/dchest/uniuri"
)

var caseInsensitiveAlphabet = []byte("abcdefghijklmnopqrstuvwxyz1234567890")

func GenerateID() string {
	return uniuri.NewLenChars(uniuri.UUIDLen, caseInsensitiveAlphabet)
}
