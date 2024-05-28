package host

import (
	"log"
	"sync"
)

var syncingLock sync.RWMutex

func WaitForHostSync() {
	syncingLock.RLock()
	syncingLock.RUnlock()

	log.Printf("Clock sync lock passed")
}
