package permissions

import (
	"fmt"
	"os"
	"strconv"
)

func GetMode(mode string) (os.FileMode, error) {
	// Base 0 should auto-detect the base based on the first character
	perm, err := strconv.ParseUint(mode, 0, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid mode: %w", err)
	}

	return os.FileMode(perm), nil
}
