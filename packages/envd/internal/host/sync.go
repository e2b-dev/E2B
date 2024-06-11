package host

import (
	"context"
	"fmt"
	"os/exec"
	"sync"
	"time"
)

var syncingLock sync.RWMutex

const syncTimeout = 2 * time.Second

func updateClock() error {
	ctx, cancel := context.WithTimeout(context.Background(), syncTimeout)
	defer cancel()

	// The chronyc -a makestep is not immediately stepping the clock
	err := exec.CommandContext(ctx, "/usr/bin/bash", "-c", "/usr/bin/date -s @$(/usr/sbin/phc_ctl /dev/ptp0 get | cut -d' ' -f5)").Run()
	if err != nil {
		return fmt.Errorf("failed to update clock: %w", err)
	}

	return nil
}

func Sync() error {
	syncingLock.Lock()
	defer syncingLock.Unlock()

	err := updateClock()
	if err != nil {
		return fmt.Errorf("failed to sync clock: %w", err)
	}

	return nil
}

func WaitForSync() {
	syncingLock.RLock()
	syncingLock.RUnlock()
}
