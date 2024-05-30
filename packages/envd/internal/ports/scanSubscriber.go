package ports

import "github.com/drael/GOnetstat"

// If we want to create a listener/subscriber pattern somewhere else we should move
// from a concrete implementation to combination of generics and interfaces.

type ScannerSubscriber struct {
	filter   *ScannerFilter
	Messages chan ([]GOnetstat.Process)
	id       string
}

func NewScannerSubscriber(id string, filter *ScannerFilter) *ScannerSubscriber {
	return &ScannerSubscriber{
		id:       id,
		filter:   filter,
		Messages: make(chan []GOnetstat.Process),
	}
}

func (ss *ScannerSubscriber) ID() string {
	return ss.id
}

func (ss *ScannerSubscriber) Destroy() {
	close(ss.Messages)
}

func (ss *ScannerSubscriber) Signal(proc []GOnetstat.Process) {
	// Filter isn't specified. Accept everything.
	if ss.filter == nil {
		ss.Messages <- proc
	} else {
		filtered := []GOnetstat.Process{}
		for i := range proc {
			// We need to access the list directly otherwise there will be implicit memory aliasing
			// If the filter matched a process, we will send it to a channel.
			if ss.filter.Match(&proc[i]) {
				filtered = append(filtered, proc[i])
			}
		}
		ss.Messages <- filtered
	}
}
