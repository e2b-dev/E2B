package firevm

import (
	"context"
	"fmt"
	"net"
	"runtime"

	"github.com/coreos/go-iptables/iptables"
	consul "github.com/hashicorp/consul/api"
	"github.com/hashicorp/go-hclog"
	"github.com/txn2/txeh"
	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
)

const hostDefaultGateway = "ens4"

func CreateNetworking(ctx context.Context, consulClient consul.Client, nodeID string, sessionID string, logger hclog.Logger, hosts *txeh.Hosts) (*IPSlot, error) {
	// 1. Get slot
	ipSlot, err := getIPSlot(consulClient, nodeID, sessionID, logger)
	if err != nil {
		return nil, fmt.Errorf("Failed to get IP slot: %v", err)
	}

	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	hostNS, err := netns.Get()
	defer hostNS.Close()
	if err != nil {
		return nil, fmt.Errorf("Cannot get current namespace %v", err)
	}

	// 2. Create NS
	// Execute commands in the selected network namespace and then change back to the default namespace
	ns, err := netns.NewNamed(ipSlot.NamespaceID())
	defer ns.Close()
	if err != nil {
		return nil, fmt.Errorf("Cannot create new namespace %v", err)
	}

	// 3. Create Tap device
	tapAttrs := netlink.NewLinkAttrs()
	tapAttrs.Name = ipSlot.TapName()
	// We may not need to define NS here if the whole thread is in a specific NS we created before
	tapAttrs.Namespace = ns
	tap := &netlink.Tuntap{
		Mode:      netlink.TUNTAP_MODE_TAP,
		LinkAttrs: tapAttrs,
	}
	err = netlink.LinkAdd(tap)
	if err != nil {
		return nil, fmt.Errorf("Error creating tap device %v", err)
	}

	err = netlink.LinkSetUp(tap)
	if err != nil {
		return nil, fmt.Errorf("Error setting tap device up %v", err)
	}

	err = netlink.AddrAdd(tap, &netlink.Addr{
		IPNet: &net.IPNet{
			IP:   net.IP(ipSlot.TapIP()),
			Mask: net.IPMask(ipSlot.TapMask()),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("Error setting address of the tap device %v", err)
	}

	// 4. Set lo device up - not sure if this is necessary
	// lo := &netlink.
	// netlink.LinkSetUp()
	// err = exec.Command("ip", "netns", "exec", ns, "ip", "link", "set", "lo", "up").Run()
	// if err != nil {
	// 	return nil, fmt.Errorf("Error running command tap up %v", err)
	// }

	// 5. Add veth connection
	vethAttrs := netlink.NewLinkAttrs()
	vethAttrs.Name = ipSlot.VethName()
	vethAttrs.Namespace = hostNS
	veth := &netlink.Veth{
		LinkAttrs:     vethAttrs,
		PeerNamespace: ns,
		PeerName:      ipSlot.VpeerName(),
	}
	err = netlink.LinkAdd(veth)
	if err != nil {
		return nil, fmt.Errorf("Error creating veth device %v", err)
	}

	err = netlink.LinkSetUp(veth)
	if err != nil {
		return nil, fmt.Errorf("Error setting veth device up %v", err)
	}

	err = netlink.AddrAdd(veth, &netlink.Addr{
		IPNet: &net.IPNet{
			IP:   net.IP(ipSlot.VethIP()),
			Mask: net.IPMask(ipSlot.VMask()),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("Error adding veth device address %v", err)
	}

	vpeer, err := netlink.LinkByName(ipSlot.VpeerName())
	if err != nil {
		return nil, fmt.Errorf("Error finding vpeer %v", err)
	}

	err = netlink.LinkSetUp(vpeer)
	if err != nil {
		return nil, fmt.Errorf("Error setting vpeer device up %v", err)
	}

	err = netlink.AddrAdd(veth, &netlink.Addr{
		IPNet: &net.IPNet{
			IP:   net.IP(ipSlot.VpeerIP()),
			Mask: net.IPMask(ipSlot.VMask()),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("Error adding vpeer device address %v", err)
	}

	// 6. Add NS default route
	err = netlink.RouteAdd(&netlink.Route{
		Scope: netlink.SCOPE_UNIVERSE,
		Gw:    net.ParseIP(ipSlot.VethIP()),
	})
	if err != nil {
		return nil, fmt.Errorf("Error adding default NS route %v", err)
	}

	tables, err := iptables.New()
	if err != nil {
		return nil, fmt.Errorf("Error initializing iptables %v", err)
	}

	// 7. Add NAT routing rules to NS
	tables.Append("nat", "POSTROUTING", "-o", ipSlot.VpeerName(), "-s", ipSlot.NamespaceSnapshotIP(), "-j", "SNAT", "--to", ipSlot.HostSnapshotIP())
	tables.Append("nat", "PREROUTING", "-i", ipSlot.VpeerName(), "-d", ipSlot.HostSnapshotIP(), "-j", "DNAT", "--to", ipSlot.NamespaceSnapshotIP())

	// Go back to original namespace
	netns.Set(ns)

	err = netlink.RouteAdd(&netlink.Route{
		Gw: net.ParseIP(ipSlot.VethIP()),
		Dst: &net.IPNet{
			IP: net.IP(ipSlot.HostSnapshotIP()),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("Error adding route from host to FC %v", err)
	}

	// 8. Add host forwarding rules
	tables.Append("filter", "FORWARD", "-i", ipSlot.VethName(), "-o", hostDefaultGateway, "-j", "ACCEPT")
	tables.Append("filter", "FORWARD", "-i", hostDefaultGateway, "-o", ipSlot.VethName(), "-j", "ACCEPT")

	tables.Append("nat", "POSTROUTING", "-s", ipSlot.HostSnapshotIP()+"/32", "-o", hostDefaultGateway, "-j", "MASQUERADE")

	// 9. Add namespace to etc netns and resolv
	// TODO: Is this needed?
	// mkdir -p "/etc/netns/$NS"
	// ln -s /run/systemd/resolve/resolv.conf /etc/netns/"$NS"/resolv.conf

	// 10. Add entry to etc hosts
	hosts.AddHost(ipSlot.HostSnapshotIP(), ipSlot.SessionID)
	err = hosts.Save()
	if err != nil {
		return nil, fmt.Errorf("Error adding session to etc hosts %v", err)
	}

	return ipSlot, nil
}

func (ipSlot *IPSlot) RemoveNetworking(consulClient consul.Client, logger hclog.Logger, hosts *txeh.Hosts) {
	return
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	hosts.RemoveAddress(ipSlot.SessionID)
	err := hosts.Save()
	if err != nil {
		logger.Error("Error adding session to etc hosts %v", err)
	}

	// 9. not implemented

	tables, err := iptables.New()
	if err != nil {
		logger.Error("Error initializing iptables %v", err)
	}

	tables.Delete("filter", "FORWARD", "-i", ipSlot.VethName(), "-o", hostDefaultGateway, "-j", "ACCEPT")
	tables.Delete("filter", "FORWARD", "-i", hostDefaultGateway, "-o", ipSlot.VethName(), "-j", "ACCEPT")

	tables.Delete("nat", "POSTROUTING", "-s", ipSlot.HostSnapshotIP()+"/32", "-o", hostDefaultGateway, "-j", "MASQUERADE")

	err = netlink.RouteDel(&netlink.Route{
		Gw: net.ParseIP(ipSlot.VethIP()),
		Dst: &net.IPNet{
			IP: net.IP(ipSlot.HostSnapshotIP()),
		},
	})
	if err != nil {
		logger.Error("Error adding route from host to FC %v", err)
	}

	err = netns.DeleteNamed(ipSlot.NamespaceID())
	if err != nil {
		logger.Error("Error deleting namespace %v", err)
	}

	// Maybe remove veth that is in Host NS

	ipSlot.releaseIPSlot(consulClient, logger)
}
