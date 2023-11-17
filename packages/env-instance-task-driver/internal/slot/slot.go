package slot

import (
	"context"
	"fmt"
	"time"

	consul "github.com/hashicorp/consul/api"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

// We are using a more debuggable IP address allocation for now that only covers 255 addresses.
const (
	octetSize   = 256
	octetMax    = octetSize - 1
	IPSlotsSize = octetSize * octetSize

	HostSnapshotMask = 32
	VMask            = 31
	TapMask          = 30
)

type IPSlot struct {
	InstanceID  string
	NodeShortID string
	KVKey       string
	SlotIdx     int
}

const slotCheckWaitTime = 2

func (ips *IPSlot) VpeerName() string {
	return "eth0"
}

func (ips *IPSlot) getOctets() (int, int) {
	rem := ips.SlotIdx % octetMax
	octet := (ips.SlotIdx - rem) / octetMax

	return octet, rem
}

func (ips *IPSlot) VpeerIP() string {
	firstOctet, secondOctet := ips.getOctets()

	return fmt.Sprintf("10.%d.%d.2", firstOctet, secondOctet)
}

func (ips *IPSlot) VethIP() string {
	firstOctet, secondOctet := ips.getOctets()

	return fmt.Sprintf("10.%d.%d.1", firstOctet, secondOctet)
}

func (ips *IPSlot) VMask() int {
	return VMask
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
	return HostSnapshotMask
}

func (ips *IPSlot) HostSnapshotIP() string {
	firstOctet, secondOctet := ips.getOctets()

	return fmt.Sprintf("192.168.%d.%d", firstOctet, secondOctet)
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
	return TapMask
}

func (ips *IPSlot) TapCIDR() string {
	return fmt.Sprintf("%s/%d", ips.TapIP(), ips.TapMask())
}

func New(ctx context.Context, nodeID, instanceID, consulToken string, tracer trace.Tracer) (*IPSlot, error) {
	childCtx, childSpan := tracer.Start(ctx, "reserve-ip-slot")
	defer childSpan.End()

	config := consul.DefaultConfig()
	config.Token = consulToken

	consulClient, err := consul.NewClient(config)
	if err != nil {
		errMsg := fmt.Errorf("failed to initialize Consul client: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "initialized Consul client")

	kv := consulClient.KV()

	var slot *IPSlot

	nodeShortID := nodeID[:8]

	for {
		for slotIdx := 0; slotIdx <= IPSlotsSize; slotIdx++ {
			key := fmt.Sprintf("%s/%d", nodeShortID, slotIdx)

			status, _, err := kv.CAS(&consul.KVPair{
				Key:         key,
				ModifyIndex: 0,
				Value:       []byte(instanceID),
			}, nil)
			if err != nil {
				errMsg := fmt.Errorf("failed to write to Consul KV: %w", err)
				telemetry.ReportCriticalError(childCtx, errMsg)

				return nil, errMsg
			}

			if status {
				slot = &IPSlot{
					InstanceID:  instanceID,
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

	telemetry.SetAttributes(
		childCtx,
		attribute.String("kv_key", slot.KVKey),
		attribute.String("node_short_id", slot.NodeShortID),
		attribute.String("instance_id", slot.InstanceID),
	)

	return slot, nil
}

func (ips *IPSlot) Release(ctx context.Context, consulToken string, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "release-ip-slot",
		trace.WithAttributes(
			attribute.String("kv_key", ips.KVKey),
			attribute.String("node_short_id", ips.NodeShortID),
			attribute.String("instance_id", ips.InstanceID),
		),
	)
	defer childSpan.End()

	config := consul.DefaultConfig()
	config.Token = consulToken

	consulClient, err := consul.NewClient(config)
	if err != nil {
		errMsg := fmt.Errorf("failed to initialize Consul client: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "initialized Consul client")

	kv := consulClient.KV()

	pair, _, err := kv.Get(ips.KVKey, nil)
	if err != nil {
		errMsg := fmt.Errorf("failed to release IPSlot: Failed to read Consul KV: %w", err)

		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	if pair == nil {
		errMsg := fmt.Errorf("IP slot %d for instance %s was already released", ips.SlotIdx, ips.InstanceID)
		telemetry.ReportError(childCtx, errMsg)

		return nil
	}

	if string(pair.Value) != ips.InstanceID {
		errMsg := fmt.Errorf("IP slot %d for instance %s was already realocated to instance %s", ips.SlotIdx, ips.InstanceID, string(pair.Value))
		telemetry.ReportError(childCtx, errMsg)

		return nil
	}

	status, _, err := kv.DeleteCAS(&consul.KVPair{
		Key:         ips.KVKey,
		ModifyIndex: pair.ModifyIndex,
	}, nil)
	if err != nil {
		errMsg := fmt.Errorf("failed to release IPSlot: Failed to delete slot from Consul KV: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	if !status {
		errMsg := fmt.Errorf("IP slot %d for instance %s was already realocated to instance %s", ips.SlotIdx, ips.InstanceID, string(pair.Value))
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "ip slot released")

	return nil
}
