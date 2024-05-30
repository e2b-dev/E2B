package ports

import (
	"github.com/drael/GOnetstat"
)

type ScannerFilter struct {
	State string
	IPs   []string
}

func (sf *ScannerFilter) Match(proc *GOnetstat.Process) bool {
	// Filter is an empty struct.
	if sf.State == "" && len(sf.IPs) == 0 {
		return false
	}

	ipMatch := false

	for _, ip := range sf.IPs {
		if ip == proc.Ip {
			ipMatch = true

			break
		}
	}

	if ipMatch && sf.State == proc.State {
		return true
	}

	return false
}
