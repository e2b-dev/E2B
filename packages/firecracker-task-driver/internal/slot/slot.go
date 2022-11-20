package slot

import (
	"context"
	"fmt"
	"time"

	"github.com/devbookhq/firecracker-task-driver/internal/telemetry"
	consul "github.com/hashicorp/consul/api"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// We are using a more debuggable IP address allocation for now
const IPSlotRange = 255

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
	return fmt.Sprintf("10.0.%d.2", ips.SlotIdx)
}

func (ips *IPSlot) VethIP() string {
	return fmt.Sprintf("10.0.%d.1", ips.SlotIdx)
}

func (ips *IPSlot) VMask() int {
	return 24
}

func (ips *IPSlot) VethName() string {
	return fmt.Sprintf("veth-%d", ips.SlotIdx)
}

func (ips *IPSlot) VethCIDR() string {
	return fmt.Sprintf("%s/%d", ips.VethIP(), ips.VMask())
}

func (ips *IPSlot) VpeerCIDR() string {
	return fmt.Sprintf("%s/%d", ips.VpeerIP(), ips.VMask())
}

func (ips *IPSlot) HostSnapshotCIDR() string {
	return fmt.Sprintf("%s/%d", ips.HostSnapshotIP(), ips.HostSnapshotMask())
}

func (ips *IPSlot) HostSnapshotMask() int {
	return 32
}

func (ips *IPSlot) HostSnapshotIP() string {
	return fmt.Sprintf("192.168.%d.1", ips.SlotIdx)
}

func (ips *IPSlot) NamespaceSnapshotIP() string {
	return "169.254.0.21"
}

func (ips *IPSlot) NamespaceID() string {
	return fmt.Sprintf("ns-%d", ips.SlotIdx)
}

func (ips *IPSlot) TapName() string {
	return "tap0"
}

func (ips *IPSlot) TapIP() string {
	return "169.254.0.22"
}

func (ips *IPSlot) TapMask() int {
	return 30
}

func (ips *IPSlot) TapCIDR() string {
	return fmt.Sprintf("%s/%d", ips.TapIP(), ips.TapMask())
}

func New(ctx context.Context, nodeID, sessionID, consulToken string, tracer trace.Tracer) (*IPSlot, error) {
	childCtx, childSpan := tracer.Start(ctx, "reserve-ip-slot")
	defer childSpan.End()

	config := consul.DefaultConfig()
	config.Token = consulToken

	consulClient, err := consul.NewClient(config)
	if err != nil {
		errMsg := fmt.Errorf("failed to initialize Consul client: %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "initialized Consul client")

	kv := consulClient.KV()

	var slot *IPSlot

	nodeShortID := nodeID[:8]

	for {
		for slotIdx := 0; slotIdx <= IPSlotRange; slotIdx++ {
			key := fmt.Sprintf("%s/%d", nodeShortID, slotIdx)
			status, _, err := kv.CAS(&consul.KVPair{
				Key:         key,
				ModifyIndex: 0,
				Value:       []byte(sessionID),
			}, &consul.WriteOptions{})

			if err != nil {
				errMsg := fmt.Errorf("failed to write to Consul KV: %v", err)
				telemetry.ReportCriticalError(childCtx, errMsg)
				return nil, errMsg
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
		telemetry.ReportEvent(childCtx, msg)
		time.Sleep(slotCheckWaitTime * time.Second)
	}
	telemetry.ReportEvent(childCtx, "ip slot reserved")

	childSpan.SetAttributes(
		attribute.String("kv_key", slot.KVKey),
		attribute.String("node_short_id", slot.NodeShortID),
		attribute.String("session_id", slot.SessionID),
	)

	return slot, nil
}

func (slot *IPSlot) Release(ctx context.Context, consulToken string, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "release-ip-slot",
		trace.WithAttributes(
			attribute.String("kv_key", slot.KVKey),
			attribute.String("node_short_id", slot.NodeShortID),
			attribute.String("session_id", slot.SessionID),
		),
	)
	defer childSpan.End()

	config := consul.DefaultConfig()
	config.Token = consulToken

	consulClient, err := consul.NewClient(config)
	if err != nil {
		errMsg := fmt.Errorf("failed to initialize Consul client: %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "initialized Consul client")

	kv := consulClient.KV()

	pair, _, err := kv.Get(slot.KVKey, &consul.QueryOptions{})
	if err != nil {
		errMsg := fmt.Errorf("failed to release IPSlot: Failed to read Consul KV: %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}

	if pair == nil {
		errMsg := fmt.Errorf("IP slot %d for session %s was already released", slot.SlotIdx, slot.SessionID)
		telemetry.ReportError(childCtx, errMsg)
		return nil
	}

	if string(pair.Value) != slot.SessionID {
		errMsg := fmt.Errorf("IP slot %d for session %s was already realocated to session %s", slot.SlotIdx, slot.SessionID, string(pair.Value))
		telemetry.ReportError(childCtx, errMsg)
		return nil
	}

	status, _, err := kv.DeleteCAS(&consul.KVPair{
		Key:         slot.KVKey,
		ModifyIndex: pair.ModifyIndex,
	}, &consul.WriteOptions{})
	if err != nil {
		errMsg := fmt.Errorf("failed to release IPSlot: Failed to delete slot from Consul KV: %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}

	if !status {
		errMsg := fmt.Errorf("IP slot %d for session %s was already realocated to session %s", slot.SlotIdx, slot.SessionID, string(pair.Value))
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "ip slot released")

	return nil
}
