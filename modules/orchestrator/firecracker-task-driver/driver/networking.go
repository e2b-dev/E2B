package firevm

import (
	"context"
	"fmt"
	"os/exec"

	"github.com/coreos/go-iptables/iptables"
	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
	consul "github.com/hashicorp/consul/api"
	"github.com/hashicorp/go-hclog"
	"github.com/txn2/txeh"
)

func CreateNetworking(ctx context.Context, consulClient consul.Client, nodeID string, sessionID string, logger hclog.Logger, hosts *txeh.Hosts) (*IPSlot, error) {
	ipSlot, err := getIPSlot(consulClient, nodeID, sessionID, logger)
	if err != nil {
		return nil, fmt.Errorf("Failed to get IP slot: %v", err)
	}

  // runtime.LockOSThread()
  //   defer runtime.UnlockOSThread()

	
	origin, err := netns.Get()
	defer origin.Close()

	ns := ipSlot.NamespaceID()
	tap := ipSlot.TapName()
	tapCIDR := ipSlot.TapCIDR()

	// err = exec.Command("ip", "netns", "add", ns).Run()
	// if err != nil {
	// 	return nil, fmt.Errorf("Error running command netns add %v", err)
	// }
	newns, _ := netns.NewNamed(ns)
	defer newns.Close()
	

	netlink
	// TODO: Execute commands in the selected network namespace and then change back to the default namespace



	err = exec.Command("ip", "netns", "exec", ns, "ip", "tuntap", "add", "name", tap, "mode", "tap").Run()
	if err != nil {
		return nil, fmt.Errorf("Error running command tuntap add %v", err)
	}

	err = exec.Command("ip", "netns", "exec", ns, "ip", "link", "set", tap, "up").Run()
	if err != nil {
		return nil, fmt.Errorf("Error running command tap up %v", err)
	}

	err = exec.Command("ip", "netns", "exec", ns, "ip", "addr", "add", tapCIDR, "dev", tap).Run()
	if err != nil {
		return nil, fmt.Errorf("Error running command ip add %v", err)
	}

	err = exec.Command("ip", "netns", "exec", ns, "ip", "link", "set", "lo", "up").Run()
	if err != nil {
		return nil, fmt.Errorf("Error running command tap up %v", err)
	}


	// # Change
	// # NS="6c258a8a-9304-4e82-a80b-aa2c0033abb0"
	// NS=ns$1
	// # VETH="veth4"
	// VETH=veth$1
	// # VETH_ADDR="10.0.3.1"
	// VETH_ADDR="10.0.$1.1"
	// # VPEER_ADDR="10.0.3.2"
	// VPEER_ADDR="10.0.$1.2"

	// # FC_HOST_IP="192.168.3.3"
	// FC_HOST_IP="192.168.$1.3"
	// #

	// MASK="/24"
	// VPEER="eth0"
	// FC_SNASPHOT_IP="169.254.0.21"

	// ip -n ${NS} link set lo up

	// ip -n ${NS} link add ${VETH} type veth peer name ${VPEER}
	// ip -n ${NS} addr add ${VPEER_ADDR}${MASK} dev ${VPEER}
	// ip -n ${NS} link set ${VPEER} up

	// ip -n ${NS} link set ${VETH} netns 1
	// ip link set ${VETH} up
	// ip addr add ${VETH_ADDR}${MASK} dev ${VETH}

	// ip -n ${NS} route add default via ${VETH_ADDR}


	tables, err := iptables.New()

	tables.Append("nat", "POSTROUTING",)
	

	// ip netns exec ${NS} iptables -t nat -A POSTROUTING -o ${VPEER} -s ${FC_SNASPHOT_IP} -j SNAT --to ${FC_HOST_IP}
	// ip netns exec ${NS} iptables -t nat -A PREROUTING -i ${VPEER} -d ${FC_HOST_IP} -j DNAT --to ${FC_SNASPHOT_IP}
	// ip route add ${FC_HOST_IP} via ${VPEER_ADDR}

	// iptables -A FORWARD -i ${VETH} -o ens4 -j ACCEPT
	// iptables -A FORWARD -i ens4 -o ${VETH} -j ACCEPT
	// iptables -t nat -A POSTROUTING -s ${FC_HOST_IP}/32 -o ens4 -j MASQUERADE

	// mkdir -p "/etc/netns/$NS"
	// ln -s /run/systemd/resolve/resolv.conf /etc/netns/"$NS"/resolv.conf

	hosts.AddHost(ipSlot.HostSnapshotIP(), ipSlot.SessionID)
	err = hosts.Save()
	if err != nil {
		return nil, fmt.Errorf("Error adding session to etc hosts %v", err)
	}

	netns.Set(origin)
	
	return ipSlot, nil
}

func (ips *IPSlot) RemoveNetworking(consulClient consul.Client, logger hclog.Logger, hosts *txeh.Hosts) {
	// Support cleanup of partial setup

	hosts.RemoveAddress(ips.SessionID)
	err := hosts.Save()
	if err != nil {
		logger.Error("Error adding session to etc hosts %v", err)
	}

	ips.releaseIPSlot(consulClient, logger)
}
