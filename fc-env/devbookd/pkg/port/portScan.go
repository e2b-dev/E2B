package port

import (
	"net"
	"time"

	"github.com/drael/GOnetstat"
)

type PortScanFilter struct {
	IPs   []net.IP
	State string
}

func (sf *PortScanFilter) Match(proc *GOnetstat.Process) bool {
	// Filter is an empty struct.
	if sf.State == "" && len(sf.IP) == 0 {
		return false
	}

	ipMatch := false
	for _, ip := range sf.IPs {
		if ip.To4().String() == proc.Ip {
			ipMatch = true
			break
		}
	}

	if ipMatch == true && sf.State == proc.State {
		return true
	}

	return false
}

type Scanner struct {
	ticker *time.Ticker

	Processes chan GOnetstat.Process
	Filter    *PortScanFilter
}

func NewScanner(period time.Duration, filter *PortScanFilter) *Scanner {
	return &Scanner{
		ticker:    time.NewTicker(period),
		Processes: make(chan GOnetstat.Process),
		Filter:    filter,
	}
}

func (s *Scanner) Scan() {
	for range s.ticker.C {
		processes := GOnetstat.Tcp()

		for _, proc := range processes {
			// Filter isn't specified.
			if s.Filter == nil {
				s.Processes <- proc
				continue
			}

			// If the filter matched a process, we will send it to a channel.
			if s.Filter.Match(&proc) {
				s.Processes <- proc
			}
		}
	}
}
