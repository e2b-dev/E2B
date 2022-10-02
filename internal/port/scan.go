package port

import (
	"sync"
	"time"

	"github.com/drael/GOnetstat"
)

type Scanner struct {
	ticker *time.Ticker

	Processes chan GOnetstat.Process

	subMutex    sync.RWMutex                  // Lock for manipulation with the subscribers map.
	subscribers map[string]*ScannerSubscriber // Map of subscribers id:Subscriber.
}

func (s *Scanner) Destroy() {
	s.ticker.Stop()
	close(s.Processes)
}

func NewScanner(period time.Duration) *Scanner {
	return &Scanner{
		ticker:      time.NewTicker(period),
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
	for range s.ticker.C {
		processes := GOnetstat.Tcp()
		for _, sub := range s.subscribers {
			go func(sub *ScannerSubscriber) {
				sub.Signal(processes)
			}(sub)
		}
	}
}
