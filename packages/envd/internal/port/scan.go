package port

import (
	"time"

	"github.com/drael/GOnetstat"

	"github.com/e2b-dev/infra/packages/envd/internal/smap"
)

type Scanner struct {
	Processes chan GOnetstat.Process
	scanExit  chan struct{}
	subs      *smap.Map[*ScannerSubscriber]
	period    time.Duration
}

func (s *Scanner) Destroy() {
	close(s.scanExit)
}

func NewScanner(period time.Duration) *Scanner {
	return &Scanner{
		period:    period,
		subs:      smap.New[*ScannerSubscriber](),
		scanExit:  make(chan struct{}),
		Processes: make(chan GOnetstat.Process, 20),
	}
}

func (s *Scanner) AddSubscriber(id string, filter *ScannerFilter) *ScannerSubscriber {
	subscriber := NewScannerSubscriber(id, filter)
	s.subs.Insert(id, subscriber)

	return subscriber
}

func (s *Scanner) Unsubscribe(sub *ScannerSubscriber) {
	s.subs.Remove(sub.ID())
	sub.Destroy()
}

// ScanAndBroadcast starts scanning open TCP ports and broadcasts every open port to all subscribers.
func (s *Scanner) ScanAndBroadcast() {
	for {
		processes := GOnetstat.Tcp()
		for _, sub := range s.subs.Items() {
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
