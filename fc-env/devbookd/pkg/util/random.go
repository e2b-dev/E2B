package util

import (
	"fmt"
	"math/rand"
	"time"
)

func RandString(length int) string {
	rand.Seed(time.Now().UnixNano())
	b := make([]byte, length)
	rand.Read(b)
	return fmt.Sprintf("%x", b)[:length]
}
