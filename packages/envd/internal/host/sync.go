package host

import (
	"fmt"
	"log"
	"os/exec"
	"sync"
)

var syncingLock sync.RWMutex

func updateClock() error {
	// The chronyc -a makestep is not immediately stepping the clock
	err := exec.Command("/usr/bin/bash", "-c", "/usr/bin/date -s @$(/usr/sbin/phc_ctl /dev/ptp0 get | cut -d' ' -f5)").Run()
	if err != nil {
		return fmt.Errorf("failed to sync clock: %w", err)
	}

	return nil
}

func Sync() {
	syncingLock.Lock()

	go func() {
		defer syncingLock.Unlock()

		err := updateClock()
		if err != nil {
			log.Printf("%v", err)
		}
	}()
}

func WaitForSync() {
	syncingLock.RLock()
	syncingLock.RUnlock()

	log.Printf("Clock sync lock passed")
}
