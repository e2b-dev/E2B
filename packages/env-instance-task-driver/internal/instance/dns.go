package instance

import (
	"fmt"
	"sync"

	"github.com/txn2/txeh"
)

type DNS struct {
	hosts *txeh.Hosts
	mu    sync.Mutex
}

func NewDNS() (*DNS, error) {
	hosts, err := txeh.NewHostsDefault()
	if err != nil {
		return nil, fmt.Errorf("error initializing etc hosts handler: %w", err)
	}

	reloadErr := hosts.Reload()
	if reloadErr != nil {
		return nil, fmt.Errorf("error reloading etc hosts: %w", reloadErr)
	}

	return &DNS{
		hosts: hosts,
	}, nil
}

func (d *DNS) Add(ips *IPSlot) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.hosts.AddHost(ips.HostSnapshotIP(), ips.InstanceID)

	err := d.hosts.Save()
	if err != nil {
		return fmt.Errorf("error adding env instance to etc hosts: %w", err)
	}

	return nil
}

func (d *DNS) Remove(ips *IPSlot) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.hosts.RemoveHost(ips.InstanceID)

	err := d.hosts.Save()
	if err != nil {
		return fmt.Errorf("error removing env instance to etc hosts: %w", err)
	}

	return nil
}
