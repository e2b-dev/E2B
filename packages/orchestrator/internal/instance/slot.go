package instance

import (
	"context"
	"fmt"
	"math/rand"
	"slices"

	consul "github.com/hashicorp/consul/api"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

// We are using a more debuggable IP address allocation for now that only covers 255 addresses.
const (
	octetSize = 256
	octetMax  = octetSize - 1
	// This is the maximum number of IP addresses that can be allocated.
	IPSlotsSize = octetSize * octetSize

	HostSnapshotMask = 32
	VMask            = 30
	TapMask          = 30
)

type IPSlot struct {
	ConsulToken string

	InstanceID  string
	NodeShortID string
	KVKey       string
	SlotIdx     int
}

func (ips *IPSlot) VpeerName() string {
	return "eth0"
}

func (ips *IPSlot) getOctets() (int, int) {
	rem := ips.SlotIdx % octetSize
	octet := (ips.SlotIdx - rem) / octetSize

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

func getConsulKV(ctx context.Context, consulToken string) (*consul.KV, error) {
	config := consul.DefaultConfig()
	config.Token = consulToken

	consulClient, err := consul.NewClient(config)
	if err != nil {
		errMsg := fmt.Errorf("failed to initialize Consul client: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return nil, errMsg
	}

	kv := consulClient.KV()

	telemetry.ReportEvent(ctx, "initialized Consul client")

	return kv, nil
}

func NewSlot(ctx context.Context, tracer trace.Tracer, nodeID, instanceID, consulToken string) (*IPSlot, error) {
	childCtx, childSpan := tracer.Start(ctx, "reserve-ip-slot")
	defer childSpan.End()

	kv, err := getConsulKV(childCtx, consulToken)
	if err != nil {
		return nil, err
	}

	var slot *IPSlot

	nodeShortID := nodeID[:8]

	trySlot := func(slotIdx int, key string) (*IPSlot, error) {
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
			return &IPSlot{
				InstanceID:  instanceID,
				SlotIdx:     slotIdx,
				NodeShortID: nodeShortID,
				KVKey:       key,
				ConsulToken: consulToken,
			}, nil
		}

		return nil, nil
	}

	for randomTry := 1; randomTry <= 10; randomTry++ {
		slotIdx := rand.Intn(IPSlotsSize)
		key := fmt.Sprintf("%s/%d", nodeShortID, slotIdx)

		maybeSlot, err := trySlot(slotIdx, key)
		if err != nil {
			return nil, err
		}

		if maybeSlot != nil {
			slot = maybeSlot

			break
		}
	}

	if slot == nil {
		// This is a fallback for the case when all slots are taken.
		// There is no Consul lock so it's possible that multiple instances will try to acquire the same slot.
		// In this case, only one of them will succeed and other will try with different slots.
		reservedKeys, _, keysErr := kv.Keys(nodeShortID+"/", "", nil)
		if keysErr != nil {
			return nil, fmt.Errorf("failed to read Consul KV: %w", keysErr)
		}

		for slotIdx := 0; slotIdx < IPSlotsSize; slotIdx++ {
			key := fmt.Sprintf("%s/%d", nodeShortID, slotIdx)

			if slices.Contains(reservedKeys, key) {
				continue
			}

			maybeSlot, err := trySlot(slotIdx, key)
			if err != nil {
				return nil, err
			}

			if maybeSlot != nil {
				slot = maybeSlot

				break
			}
		}
	}

	if slot == nil {
		errMsg := fmt.Errorf("failed to acquire IP slot: no empty slots found")
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "ip slot reserved")

	telemetry.SetAttributes(
		childCtx,
		attribute.String("instance.slot.kv.key", slot.KVKey),
		attribute.String("instance.slot.node.short_id", slot.NodeShortID),
		attribute.String("instance.id", slot.InstanceID),
	)

	return slot, nil
}

func (ips *IPSlot) Release(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "release-ip-slot",
		trace.WithAttributes(
			attribute.String("instance.slot.kv.key", ips.KVKey),
			attribute.String("instance.slot.node.short_id", ips.NodeShortID),
			attribute.String("instance.id", ips.InstanceID),
		),
	)
	defer childSpan.End()

	kv, err := getConsulKV(childCtx, ips.ConsulToken)
	if err != nil {
		return err
	}

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
