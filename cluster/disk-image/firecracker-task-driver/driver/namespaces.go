package firevm

import (
	"fmt"
	"net"
	"os"
	"runtime"

	"github.com/coreos/go-iptables/iptables"
	"github.com/hashicorp/go-hclog"
	"github.com/txn2/txeh"
	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
)

const hostDefaultGateway = "ens4"
const loNS = "lo"

func CreateNamespace(nodeID string, sessionID string, logger hclog.Logger) (*IPSlot, error) {
	// Get slot from Consul KV
	ipSlot, err := getIPSlot(nodeID, sessionID, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to get IP slot: %v", err)
	}

	// Prevent thread changes so the we can safely manipulate with namespaces
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	// Save the original (host) namespace and restore it upon function exit
	hostNS, err := netns.Get()
	if err != nil {
		return nil, fmt.Errorf("cannot get current (host) namespace %v", err)
	}
	defer func() {
		netns.Set(hostNS)
		hostNS.Close()
	}()

	// Create NS for the session
	ns, err := netns.NewNamed(ipSlot.NamespaceID())
	if err != nil {
		return nil, fmt.Errorf("cannot create new namespace [] %v", err)
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
		return nil, fmt.Errorf("error creating veth device %v", err)
	}

	vpeer, err := netlink.LinkByName(ipSlot.VpeerName())
	if err != nil {
		return nil, fmt.Errorf("error finding vpeer %v", err)
	}

	err = netlink.LinkSetUp(vpeer)
	if err != nil {
		return nil, fmt.Errorf("error setting vpeer device up %v", err)
	}

	ip, ipNet, err := net.ParseCIDR(ipSlot.VpeerCIDR())
	if err != nil {
		return nil, fmt.Errorf("error parsing vpeer CIDR %v", err)
	}

	err = netlink.AddrAdd(vpeer, &netlink.Addr{
		IPNet: &net.IPNet{
			IP:   ip,
			Mask: ipNet.Mask,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("error adding vpeer device address %v", err)
	}

	// Move Veth device to the host NS
	err = netlink.LinkSetNsFd(veth, int(hostNS))
	if err != nil {
		return nil, fmt.Errorf("error moving veth device to the host namespace %v", err)
	}

	netns.Set(hostNS)

	vethInHost, err := netlink.LinkByName(ipSlot.VethName())
	if err != nil {
		return nil, fmt.Errorf("error finding veth %v", err)
	}

	err = netlink.LinkSetUp(vethInHost)
	if err != nil {
		return nil, fmt.Errorf("error setting veth device up %v", err)
	}

	ip, ipNet, err = net.ParseCIDR(ipSlot.VethCIDR())
	if err != nil {
		return nil, fmt.Errorf("error parsing veth  CIDR %v", err)
	}

	err = netlink.AddrAdd(vethInHost, &netlink.Addr{
		IPNet: &net.IPNet{
			IP:   ip,
			Mask: ipNet.Mask,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("error adding veth device address %v", err)
	}

	netns.Set(ns)

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
		return nil, fmt.Errorf("error creating tap device %v", err)
	}

	err = netlink.LinkSetUp(tap)
	if err != nil {
		return nil, fmt.Errorf("error setting tap device up %v", err)
	}

	ip, ipNet, err = net.ParseCIDR(ipSlot.TapCIDR())
	if err != nil {
		return nil, fmt.Errorf("error parsing tap CIDR %v", err)
	}

	err = netlink.AddrAdd(tap, &netlink.Addr{
		IPNet: &net.IPNet{
			IP:   ip,
			Mask: ipNet.Mask,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("error setting address of the tap device %v", err)
	}

	// Set NS lo device up
	lo, err := netlink.LinkByName(loNS)
	if err != nil {
		return nil, fmt.Errorf("error finding lo %v", err)
	}

	err = netlink.LinkSetUp(lo)
	if err != nil {
		return nil, fmt.Errorf("error setting lo device up %v", err)
	}

	// Add NS default route
	err = netlink.RouteAdd(&netlink.Route{
		Scope: netlink.SCOPE_UNIVERSE,
		Gw:    net.ParseIP(ipSlot.VethIP()),
	})
	if err != nil {
		return nil, fmt.Errorf("error adding default NS route %v", err)
	}

	tables, err := iptables.New()
	if err != nil {
		return nil, fmt.Errorf("error initializing iptables %v", err)
	}

	// Add NAT routing rules to NS
	tables.Append("nat", "POSTROUTING", "-o", ipSlot.VpeerName(), "-s", ipSlot.NamespaceSnapshotIP(), "-j", "SNAT", "--to", ipSlot.HostSnapshotIP())
	tables.Append("nat", "PREROUTING", "-i", ipSlot.VpeerName(), "-d", ipSlot.HostSnapshotIP(), "-j", "DNAT", "--to", ipSlot.NamespaceSnapshotIP())

	// Go back to original namespace
	netns.Set(hostNS)

	// Add routing from host to FC namespace
	_, ipNet, err = net.ParseCIDR(ipSlot.HostSnapshotCIDR())
	if err != nil {
		return nil, fmt.Errorf("error parsing host snapshot CIDR %v", err)
	}

	err = netlink.RouteAdd(&netlink.Route{
		Gw:  net.ParseIP(ipSlot.VpeerIP()),
		Dst: ipNet,
	})
	if err != nil {
		return nil, fmt.Errorf("error adding route from host to FC %v", err)
	}

	// Add host forwarding rules
	tables.Append("filter", "FORWARD", "-i", ipSlot.VethName(), "-o", hostDefaultGateway, "-j", "ACCEPT")
	tables.Append("filter", "FORWARD", "-i", hostDefaultGateway, "-o", ipSlot.VethName(), "-j", "ACCEPT")

	// Add host postrouting rules
	tables.Append("nat", "POSTROUTING", "-s", ipSlot.HostSnapshotCIDR(), "-o", hostDefaultGateway, "-j", "MASQUERADE")

	// Add namespace to etc netns and resolv
	// TODO: Is this needed?
	// mkdir -p "/etc/netns/$NS"
	// ln -s /run/systemd/resolve/resolv.conf /etc/netns/"$NS"/resolv.conf

	hosts, err := txeh.NewHostsDefault()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize etc hosts handler: %v", err)
	}

	// Add entry to etc hosts
	hosts.AddHost(ipSlot.HostSnapshotIP(), ipSlot.SessionID)
	err = hosts.Save()
	if err != nil {
		return nil, fmt.Errorf("error adding session to etc hosts %v", err)
	}

	return ipSlot, nil
}

func (ipSlot *IPSlot) RemoveNamespace(logger hclog.Logger) error {
	hosts, err := txeh.NewHostsDefault()
	if err != nil {
		logger.Error("Failed to initialize etc hosts handler: %v", err)
	}

	hosts.RemoveAddress(ipSlot.HostSnapshotIP())
	err = hosts.Save()
	if err != nil {
		logger.Error("error adding session to etc hosts %v", err)
	}

	tables, err := iptables.New()
	if err != nil {
		logger.Error("error initializing iptables %v", err)
	}

	// Delete host forwarding rules
	tables.Delete("filter", "FORWARD", "-i", ipSlot.VethName(), "-o", hostDefaultGateway, "-j", "ACCEPT")
	tables.Delete("filter", "FORWARD", "-i", hostDefaultGateway, "-o", ipSlot.VethName(), "-j", "ACCEPT")

	// Delete host postrouting rules
	tables.Delete("nat", "POSTROUTING", "-s", ipSlot.HostSnapshotCIDR(), "-o", hostDefaultGateway, "-j", "MASQUERADE")

	// Delete routing from host to FC namespace
	_, ipNet, err := net.ParseCIDR(ipSlot.HostSnapshotCIDR())
	if err != nil {
		logger.Error("error parsing host snapshot CIDR %v", err)
	}

	err = netlink.RouteDel(&netlink.Route{
		Gw:  net.ParseIP(ipSlot.VpeerIP()),
		Dst: ipNet,
	})
	if err != nil {
		logger.Error("error deleting route from host to FC %v", err)
	}

	err = os.RemoveAll(ipSlot.SessionTmp())
	if err != nil {
		logger.Error("error deleting session tmp files (overlay, workdir) %v", err)
		// return fmt.Errorf("error deleting session tmp files (overlay, workdir) %v", err)
	}

	err = netns.DeleteNamed(ipSlot.NamespaceID())
	if err != nil {
		logger.Error("error deleting namespace %v", err)
		// return fmt.Errorf("error deleting namespace %v", err)
	}

	err = ipSlot.releaseIPSlot(logger)
	if err != nil {
		return fmt.Errorf("error releasing slot %v", err)
	}

	return nil
}
