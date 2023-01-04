package port

import (
	"sync"
	"time"

	"github.com/drael/GOnetstat"
)

type Scanner struct {
	Processes chan GOnetstat.Process

	scanExit chan bool
	period   time.Duration

	subMutex    sync.Mutex                    // Lock for manipulation with the subscribers map.
	subscribers map[string]*ScannerSubscriber // Map of subscribers id:Subscriber.
}

func (s *Scanner) Destroy() {
	s.scanExit <- true
}

func NewScanner(period time.Duration) *Scanner {
	return &Scanner{
		period:      period,
		scanExit:    make(chan bool),
		Processes:   make(chan GOnetstat.Process),
		subscribers: make(map[string]*ScannerSubscriber),
	}
}

func (s *Scanner) AddSubscriber(id string, filter *ScannerFilter) *ScannerSubscriber {
	s.subMutex.Lock()
	defer s.subMutex.Unlock()

	subscriber := NewScannerSubscriber(id, filter)
	s.subscribers[id] = subscriber

	return subscriber
}

func (s *Scanner) Unsubscribe(sub *ScannerSubscriber) {
	s.subMutex.Lock()
	delete(s.subscribers, sub.ID())
	s.subMutex.Unlock()

	sub.Destroy()
}

// ScanAndBroadcast starts scanning open TCP ports and broadcasts every open port to all subscribers.
func (s *Scanner) ScanAndBroadcast() {
	for {
		processes := GOnetstat.Tcp()
		for _, sub := range s.subscribers {
			sub.Signal(processes)
		}
		select {
		case <-s.scanExit:
			return
		default:
			time.Sleep(s.period)
		}
	}
}
