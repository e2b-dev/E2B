package firevm

import (
	"context"
	"fmt"
	"net"
	"runtime"

	"github.com/cneira/firecracker-task-driver/driver/slot"
	"github.com/cneira/firecracker-task-driver/driver/telemetry"
	"github.com/coreos/go-iptables/iptables"
	"github.com/txn2/txeh"
	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
	"go.opentelemetry.io/otel/trace"
)

const hostDefaultGateway = "ens4"
const loNS = "lo"

func CreateNetwork(
	ctx context.Context,
	ipSlot *slot.IPSlot,
	hosts *txeh.Hosts,
	tracer trace.Tracer,
) error {
	childCtx, childSpan := tracer.Start(ctx, "create-network")
	defer childSpan.End()

	// Prevent thread changes so the we can safely manipulate with namespaces
	telemetry.ReportEvent(childCtx, "waiting for OS thread lock")
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	telemetry.ReportEvent(childCtx, "OS thread lock passed")

	// Save the original (host) namespace and restore it upon function exit
	hostNS, err := netns.Get()
	if err != nil {
		errMsg := fmt.Errorf("cannot get current (host) namespace %v", err)
		return errMsg
	}
	defer func() {
		err = netns.Set(hostNS)
		if err != nil {
			errMsg := fmt.Errorf("error resetting network namespace back to the host namespace %v", err)
			telemetry.ReportError(childCtx, errMsg)
		}
		err = hostNS.Close()
		if err != nil {
			errMsg := fmt.Errorf("error closing host network namespace %v", err)
			telemetry.ReportError(childCtx, errMsg)
		}
	}()

	// Create NS for the session
	ns, err := netns.NewNamed(ipSlot.NamespaceID())
	if err != nil {
		return fmt.Errorf("cannot create new namespace [] %v", err)
	}
	defer ns.Close()

	// Create the Veth and Vpeer
	vethAttrs := netlink.NewLinkAttrs()
	vethAttrs.Name = ipSlot.VethName()
	veth := &netlink.Veth{
		LinkAttrs: vethAttrs,
		PeerName:  ipSlot.VpeerName(),
	}
	err = netlink.LinkAdd(veth)
	if err != nil {
		return fmt.Errorf("error creating veth device %v", err)
	}

	vpeer, err := netlink.LinkByName(ipSlot.VpeerName())
	if err != nil {
		return fmt.Errorf("error finding vpeer %v", err)
	}

	err = netlink.LinkSetUp(vpeer)
	if err != nil {
		return fmt.Errorf("error setting vpeer device up %v", err)
	}

	ip, ipNet, err := net.ParseCIDR(ipSlot.VpeerCIDR())
	if err != nil {
		return fmt.Errorf("error parsing vpeer CIDR %v", err)
	}

	err = netlink.AddrAdd(vpeer, &netlink.Addr{
		IPNet: &net.IPNet{
			IP:   ip,
			Mask: ipNet.Mask,
		},
	})
	if err != nil {
		return fmt.Errorf("error adding vpeer device address %v", err)
	}

	// Move Veth device to the host NS
	err = netlink.LinkSetNsFd(veth, int(hostNS))
	if err != nil {
		return fmt.Errorf("error moving veth device to the host namespace %v", err)
	}

	err = netns.Set(hostNS)
	if err != nil {
		return fmt.Errorf("error setting network namespace %v", err)
	}

	vethInHost, err := netlink.LinkByName(ipSlot.VethName())
	if err != nil {
		return fmt.Errorf("error finding veth %v", err)
	}

	err = netlink.LinkSetUp(vethInHost)
	if err != nil {
		return fmt.Errorf("error setting veth device up %v", err)
	}

	ip, ipNet, err = net.ParseCIDR(ipSlot.VethCIDR())
	if err != nil {
		return fmt.Errorf("error parsing veth  CIDR %v", err)
	}

	err = netlink.AddrAdd(vethInHost, &netlink.Addr{
		IPNet: &net.IPNet{
			IP:   ip,
			Mask: ipNet.Mask,
		},
	})
	if err != nil {
		return fmt.Errorf("error adding veth device address %v", err)
	}

	err = netns.Set(ns)
	if err != nil {
		return fmt.Errorf("error setting network namespace to %s %v", ns.String(), err)
	}

	// Create Tap device for FC in NS
	tapAttrs := netlink.NewLinkAttrs()
	tapAttrs.Name = ipSlot.TapName()
	tapAttrs.Namespace = ns
	tap := &netlink.Tuntap{
		Mode:      netlink.TUNTAP_MODE_TAP,
		LinkAttrs: tapAttrs,
	}
	err = netlink.LinkAdd(tap)
	if err != nil {
		return fmt.Errorf("error creating tap device %v", err)
	}

	err = netlink.LinkSetUp(tap)
	if err != nil {
		return fmt.Errorf("error setting tap device up %v", err)
	}

	ip, ipNet, err = net.ParseCIDR(ipSlot.TapCIDR())
	if err != nil {
		return fmt.Errorf("error parsing tap CIDR %v", err)
	}

	err = netlink.AddrAdd(tap, &netlink.Addr{
		IPNet: &net.IPNet{
			IP:   ip,
			Mask: ipNet.Mask,
		},
	})
	if err != nil {
		return fmt.Errorf("error setting address of the tap device %v", err)
	}

	// Set NS lo device up
	lo, err := netlink.LinkByName(loNS)
	if err != nil {
		return fmt.Errorf("error finding lo %v", err)
	}

	err = netlink.LinkSetUp(lo)
	if err != nil {
		return fmt.Errorf("error setting lo device up %v", err)
	}

	// Add NS default route
	err = netlink.RouteAdd(&netlink.Route{
		Scope: netlink.SCOPE_UNIVERSE,
		Gw:    net.ParseIP(ipSlot.VethIP()),
	})
	if err != nil {
		return fmt.Errorf("error adding default NS route %v", err)
	}

	tables, err := iptables.New()
	if err != nil {
		return fmt.Errorf("error initializing iptables %v", err)
	}

	// Add NAT routing rules to NS
	err = tables.Append("nat", "POSTROUTING", "-o", ipSlot.VpeerName(), "-s", ipSlot.NamespaceSnapshotIP(), "-j", "SNAT", "--to", ipSlot.HostSnapshotIP())
	if err != nil {
		errMsg := fmt.Errorf("error creating postrouting rule to vpeer %v", err)
		return errMsg
	}

	err = tables.Append("nat", "PREROUTING", "-i", ipSlot.VpeerName(), "-d", ipSlot.HostSnapshotIP(), "-j", "DNAT", "--to", ipSlot.NamespaceSnapshotIP())
	if err != nil {
		errMsg := fmt.Errorf("error creating postrouting rule from vpeer %v", err)
		return errMsg
	}

	// Go back to original namespace
	err = netns.Set(hostNS)
	if err != nil {
		return fmt.Errorf("error setting network namespace to %s %v", hostNS.String(), err)
	}

	// Add routing from host to FC namespace
	_, ipNet, err = net.ParseCIDR(ipSlot.HostSnapshotCIDR())
	if err != nil {
		return fmt.Errorf("error parsing host snapshot CIDR %v", err)
	}

	err = netlink.RouteAdd(&netlink.Route{
		Gw:  net.ParseIP(ipSlot.VpeerIP()),
		Dst: ipNet,
	})
	if err != nil {
		return fmt.Errorf("error adding route from host to FC %v", err)
	}

	// Add host forwarding rules
	err = tables.Append("filter", "FORWARD", "-i", ipSlot.VethName(), "-o", hostDefaultGateway, "-j", "ACCEPT")
	if err != nil {
		errMsg := fmt.Errorf("error creating forwarding rule to default gateway %v", err)
		return errMsg
	}

	err = tables.Append("filter", "FORWARD", "-i", hostDefaultGateway, "-o", ipSlot.VethName(), "-j", "ACCEPT")
	if err != nil {
		errMsg := fmt.Errorf("error creating forwarding rule from default gateway %v", err)
		return errMsg
	}

	// Add host postrouting rules
	err = tables.Append("nat", "POSTROUTING", "-s", ipSlot.HostSnapshotCIDR(), "-o", hostDefaultGateway, "-j", "MASQUERADE")
	if err != nil {
		errMsg := fmt.Errorf("error creating postrouting rule %v", err)
		return errMsg
	}

	// Add entry to etc hosts
	hosts.AddHost(ipSlot.HostSnapshotIP(), ipSlot.SessionID)
	err = hosts.Save()
	if err != nil {
		return fmt.Errorf("error adding session to etc hosts %v", err)
	}

	return nil
}

func RemoveNetwork(ctx context.Context, ipSlot *slot.IPSlot, hosts *txeh.Hosts, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "remove-network")
	defer childSpan.End()

	hosts.RemoveHost(ipSlot.SessionID)
	err := hosts.Save()
	if err != nil {
		errMsg := fmt.Errorf("error removing session to etc hosts %v", err)
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

	err = ipSlot.Release(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("error releasing slot %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}

	return nil
}
