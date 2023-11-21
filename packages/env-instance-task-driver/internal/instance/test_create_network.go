package instance

import (
	"context"
	"fmt"
	"net"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/coreos/go-iptables/iptables"
	"github.com/txn2/txeh"
	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

func TestCreateNetwork() {
	ctx := context.Background()

	tracer := otel.Tracer("test")
	instanceID := "i5mvy4zc573h1v47tb7pv"
	nodeShortID := instanceID[:8]
	slotIdx := 200
	key := fmt.Sprintf("%s/%d", nodeShortID, slotIdx)
	slotTest := &IPSlot{
		InstanceID:  instanceID,
		SlotIdx:     slotIdx,
		NodeShortID: nodeShortID,
		KVKey:       key,
	}

	hosts, err := txeh.NewHostsDefault()
	defer RemoveNetworkTest(ctx, slotTest, hosts, tracer)

	if err != nil {
		println(err.Error())
		panic("Failed to initialize etc hosts handler")
	}

	err = CreateNetwork(ctx, slotTest, hosts, tracer)
	if err != nil {
		println(err.Error())
		panic("Failed to create network")
	}
}

func RemoveNetworkTest(ctx context.Context, ipSlot *IPSlot, hosts *txeh.Hosts, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "remove-network")
	defer childSpan.End()

	hosts.RemoveHost(ipSlot.InstanceID)
	err := hosts.Save()
	if err != nil {
		errMsg := fmt.Errorf("error removing env instance to etc hosts %v", err)
		telemetry.ReportError(childCtx, errMsg)
	}

	tables, err := iptables.New()
	if err != nil {
		errMsg := fmt.Errorf("error initializing iptables %v", err)
		telemetry.ReportError(childCtx, errMsg)
	}

	// Delete host forwarding rules
	err = tables.Delete("filter", "FORWARD", "-i", ipSlot.VethName(), "-o", hostDefaultGateway, "-j", "ACCEPT")
	if err != nil {
		errMsg := fmt.Errorf("error deleting host forwarding rule to default gateway %v", err)
		telemetry.ReportError(childCtx, errMsg)
	}

	err = tables.Delete("filter", "FORWARD", "-i", hostDefaultGateway, "-o", ipSlot.VethName(), "-j", "ACCEPT")
	if err != nil {
		errMsg := fmt.Errorf("error deleting host forwarding rule from default gateway %v", err)
		telemetry.ReportError(childCtx, errMsg)
	}

	// Delete host postrouting rules
	err = tables.Delete("nat", "POSTROUTING", "-s", ipSlot.HostSnapshotCIDR(), "-o", hostDefaultGateway, "-j", "MASQUERADE")
	if err != nil {
		errMsg := fmt.Errorf("error deleting host postrouting rule %v", err)
		telemetry.ReportError(childCtx, errMsg)
	}

	// Delete routing from host to FC namespace
	_, ipNet, err := net.ParseCIDR(ipSlot.HostSnapshotCIDR())
	if err != nil {
		errMsg := fmt.Errorf("error parsing host snapshot CIDR %v", err)
		telemetry.ReportError(childCtx, errMsg)
	}

	err = netlink.RouteDel(&netlink.Route{
		Gw:  net.ParseIP(ipSlot.VpeerIP()),
		Dst: ipNet,
	})
	if err != nil {
		errMsg := fmt.Errorf("error deleting route from host to FC %v", err)
		telemetry.ReportError(childCtx, errMsg)
	}

	err = netns.DeleteNamed(ipSlot.NamespaceID())
	if err != nil {
		errMsg := fmt.Errorf("error deleting namespace %v", err)
		telemetry.ReportError(childCtx, errMsg)
	}

	return nil
}
