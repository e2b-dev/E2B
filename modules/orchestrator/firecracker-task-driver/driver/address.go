package firevm

import (
	"fmt"
	"time"

	consul "github.com/hashicorp/consul/api"
	"github.com/hashicorp/go-hclog"
)

const IPSlots = 255

type IPSlot struct {
	SlotIdx     int
	SessionID   string
	NodeShortID string
	KVKey       string
}

const slotCheckWaitTime = 2

func (ips *IPSlot) VpeerName() string {
	return "eth0"
}

func (ips *IPSlot) VpeerIP() string {
	return fmt.Sprintf("10.0.%d.1", ips.SlotIdx)
}

func (ips *IPSlot) VethIP() string {
	return fmt.Sprintf("10.0.%d.2", ips.SlotIdx)
}

func (ips *IPSlot) VMask() string {
	return "/24"
}

func (ips *IPSlot) VethName() string {
	return fmt.Sprintf("veth-%d", ips.SlotIdx)
}

func (ips *IPSlot) HostSnapshotIP() string {
	return fmt.Sprintf("192.168.%d.3", ips.SlotIdx)
}

func (ips *IPSlot) NamespaceSnapshotIP() string {
	return "169.254.0.21"
}

func (ips *IPSlot) NamespaceID() string {
	return fmt.Sprintf("ns-%s", ips.SessionID)
}

func (ips *IPSlot) TapName() string {
	return "tap0"
}

func (ips *IPSlot) TapIP() string {
	return "169.254.0.22"
}

func (ips *IPSlot) TapMask() string {
	return "/30"
}

func getIPSlot(consulClient consul.Client, nodeID string, sessionID string, logger hclog.Logger) (*IPSlot, error) {
	kv := consulClient.KV()

	var slot *IPSlot

	nodeShortID := nodeID[:8]

	for {
		for slotIdx := 0; slotIdx <= IPSlots; slotIdx++ {
			key := fmt.Sprintf("%s/%d", nodeShortID, slotIdx)
			pair, _, err := kv.Get(key, &consul.QueryOptions{})

			// return nil, fmt.Errorf("<<stop>>, %s", pair.Key)
			
			if err != nil {
				return nil, fmt.Errorf("Failed to read Consul KV: %v", err)
			}

			if len(pair.Value) != 0 {
				continue
			}

			status, _, err := kv.CAS(&consul.KVPair{
				Key:         key,
				ModifyIndex: pair.ModifyIndex,
				Value:       []byte(sessionID),
			}, &consul.WriteOptions{})

			if err != nil {
				return nil, fmt.Errorf("Failed to write to Consul KV: %v", err)
			}

			if status {
				slot = &IPSlot{
					SessionID:   sessionID,
					SlotIdx:     slotIdx,
					NodeShortID: nodeShortID,
					KVKey:       key,
				}
				break
			}
		}
		if slot != nil {
			break
		}
		msg := fmt.Sprintf("Failed to acquire IP slot: no empty slots found, waiting %d seconds...", slotCheckWaitTime)
		logger.Warn(msg)
		time.Sleep(slotCheckWaitTime * time.Second)
	}

	return slot, nil
}

func (slot *IPSlot) releaseIPSlot(consulClient consul.Client, logger hclog.Logger) error {
	kv := consulClient.KV()

	pair, _, err := kv.Get(slot.KVKey, &consul.QueryOptions{})
	if err != nil {
		return fmt.Errorf("Failed to release IPSlot: Failed to read Consul KV: %v", err)
	}

	if len(pair.Value) == 0 {
		msg := fmt.Sprintf("IP slot %d for session %s was already released", slot.SlotIdx, slot.SessionID)
		logger.Warn(msg)
		return nil
	}

	if string(pair.Value) != slot.SessionID {
		msg := fmt.Sprintf("IP slot %d for session %s was already realocated to session %s", slot.SlotIdx, slot.SessionID, string(pair.Value))
		logger.Error(msg)
		return nil
	}

	status, _, err := kv.CAS(&consul.KVPair{
		Key:         slot.KVKey,
		ModifyIndex: pair.ModifyIndex,
	}, &consul.WriteOptions{})

	if err != nil {
		return fmt.Errorf("Failed to release IPSlot: Failed to delete slot from Consul KV: %v", err)
	}

	if !status {
		msg := fmt.Sprintf("IP slot %d for session %s was already realocated to session %s", slot.SlotIdx, slot.SessionID, string(pair.Value))
		return fmt.Errorf(msg)
	}

	return nil
}
