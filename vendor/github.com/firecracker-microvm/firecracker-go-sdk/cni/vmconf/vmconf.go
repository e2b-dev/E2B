// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"). You may
// not use this file except in compliance with the License. A copy of the
// License is located at
//
//	http://aws.amazon.com/apache2.0/
//
// or in the "license" file accompanying this file. This file is distributed
// on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
// express or implied. See the License for the specific language governing
// permissions and limitations under the License.

/*
 Package vmconf defines an interface for converting particular CNI invocation
 results to networking configuration usable by a VM. It expects the CNI result
 to have the following properties:
 * The results should contain an interface for a tap device, which will be used
   as the VM's tap device.
 * The results should contain an interface with the same name as the tap device
   but with sandbox ID set to the containerID provided during CNI invocation.
   This should be a "pseudo-interface", not one that has actually been created.
   It represents the configuration that should be applied to the VM internally.
   The CNI "containerID" is, in this case, used more as a "vmID" to represent
   the VM's internal network interface.
     * If the CNI results specify an IP associated with this interface, that IP
       should be used to statically configure the VM's internal network interface.
*/
package vmconf

import (
	"fmt"
	"strings"

	"github.com/containernetworking/cni/pkg/types"
	current "github.com/containernetworking/cni/pkg/types/100"
	"github.com/containernetworking/plugins/pkg/ns"
	"github.com/pkg/errors"

	"github.com/firecracker-microvm/firecracker-go-sdk/cni/internal"
)

// StaticNetworkConf holds the configuration needed to configure a VM's networking
// stack. It is generally parsed from a CNI result object via the StaticNetworkConfFrom
// function.
//
// Fields beginning with "VM" are references to entities that need to be setup to
// exist *within* the VM once the VM is started.
type StaticNetworkConf struct {
	// TapName is the name of the tap device that the VM should use as its
	// network interface
	TapName string
	// NetNSPath is the path to the bind-mounted network namespace in which the VM's
	// tap device was created and thus where the VM should execute.
	NetNSPath string
	// VMIfName (optional) is interface name to configure. If left blank, config
	// is applied to the first (default) interface.
	VMIfName string

	// VMMacAddr is the mac address that callers should configure their VM to use internally.
	VMMacAddr string
	// VMMTU is the MTU that callers should configure their VM to use internally.
	VMMTU int
	// VMIPConfig is the ip configuration that callers should configure their VM's internal
	// primary interface to use.
	VMIPConfig *current.IPConfig
	// VMRoutes are the routes that callers should configure their VM's internal route table
	// to have
	VMRoutes []*types.Route

	// VMNameservers are the nameservers that callers should configure their VM to use internally
	VMNameservers []string
	// VMDomain is the resolver domain that callers should configure VM to use internally.
	VMDomain string
	// VMSearchDomans are the resolver search domains that callers should configure their VM to
	// use internally
	VMSearchDomains []string
	// VMResolverOptions are the resolve options that callers should configure their VM to use
	// internally
	VMResolverOptions []string
}

// IPBootParam provides a string that can be used as the argument to "ip=" in a Linux kernel boot
// parameters in order to boot a machine with network settings matching those in a StaticNetworkConf
// object.
//
// See "ip=" section of kernel docs here for more details:
// https://www.kernel.org/doc/Documentation/filesystems/nfs/nfsroot.txt
//
// Due to the limitation of "ip=", not all configuration specified in StaticNetworkConf can be
// applied automatically. In particular:
// * The MacAddr and MTU cannot be applied
// * The only routes created will match what's specified in VMIPConfig; VMRoutes will be ignored.
// * Only up to two namesevers can be supplied. If VMNameservers is has more than 2 entries, only
//   the first two in the slice will be applied in the VM.
// * VMDomain, VMSearchDomains and VMResolverOptions will be ignored
// * Nameserver settings are also only set in /proc/net/pnp. Most applications will thus require
//   /etc/resolv.conf to be a symlink to /proc/net/pnp in order to resolve names as expected.
func (c StaticNetworkConf) IPBootParam() string {
	// See "ip=" section of kernel linked above for details on each field listed below.

	// client-ip is really just the ip that will be assigned to the primary interface
	clientIP := c.VMIPConfig.Address.IP.String()

	// don't set nfs server IP
	const serverIP = ""

	// default gateway for the network; used to generate a corresponding route table entry
	defaultGateway := c.VMIPConfig.Gateway.String()

	// subnet mask used to generate a corresponding route table entry for the primary interface
	// (must be provided in dotted decimal notation)
	subnetMask := fmt.Sprintf("%d.%d.%d.%d",
		c.VMIPConfig.Address.Mask[0],
		c.VMIPConfig.Address.Mask[1],
		c.VMIPConfig.Address.Mask[2],
		c.VMIPConfig.Address.Mask[3],
	)

	// the "hostname" field actually just configures a hostname value for DHCP requests, thus no need to set it
	const dhcpHostname = ""

	// If blank, use the only network device present in the VM
	device := c.VMIfName

	// Don't do any autoconfiguration (i.e. DHCP, BOOTP, RARP)
	const autoconfiguration = "off"

	// up to two nameservers (if any were provided)
	var nameservers [2]string
	copy(nameservers[:], c.VMNameservers)

	// TODO(sipsma) should we support configuring an NTP server?
	const ntpServer = ""

	return strings.Join([]string{
		clientIP,
		serverIP,
		defaultGateway,
		subnetMask,
		dhcpHostname,
		device,
		autoconfiguration,
		nameservers[0],
		nameservers[1],
		ntpServer,
	}, ":")
}

// StaticNetworkConfFrom takes the result of a CNI invocation that conforms to the specification
// in this package's docstring and converts it to a StaticNetworkConf object that the caller
// can use to configure their VM with.
func StaticNetworkConfFrom(result types.Result, containerID string) (*StaticNetworkConf, error) {
	currentResult, err := current.NewResultFromResult(result)
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse cni result")
	}

	// As specified in the vmconf package docstring, we are looking for an interface who's
	// sandbox ID is the "containerID" (really "vmID" in this case) that CNI was invoked
	// with. That interface holds the configuration that should be applied to the VM's
	// internal network device.
	vmIfaceSandbox := containerID

	vmIface, tapIface, err := internal.VMTapPair(currentResult, vmIfaceSandbox)
	if err != nil {
		return nil, err
	}

	// find the IP associated with the VM iface
	vmIPs := internal.InterfaceIPs(currentResult, vmIface.Name, vmIface.Sandbox)
	if len(vmIPs) != 1 {
		return nil, errors.Errorf("expected to find 1 IP for vm interface %q, but instead found %+v",
			vmIface.Name, vmIPs)
	}
	vmIP := vmIPs[0]

	netNS, err := ns.GetNS(tapIface.Sandbox)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find netns at path %q", tapIface.Sandbox)
	}

	tapMTU, err := mtuOf(tapIface.Name, netNS, internal.DefaultNetlinkOps())
	if err != nil {
		return nil, err
	}

	return &StaticNetworkConf{
		TapName:           tapIface.Name,
		NetNSPath:         tapIface.Sandbox,
		VMMacAddr:         vmIface.Mac,
		VMMTU:             tapMTU,
		VMIPConfig:        vmIP,
		VMRoutes:          currentResult.Routes,
		VMNameservers:     currentResult.DNS.Nameservers,
		VMDomain:          currentResult.DNS.Domain,
		VMSearchDomains:   currentResult.DNS.Search,
		VMResolverOptions: currentResult.DNS.Options,
	}, nil
}

func mtuOf(ifaceName string, netNS ns.NetNS, netlinkOps internal.NetlinkOps) (int, error) {
	var mtu int
	err := netNS.Do(func(_ ns.NetNS) error {
		link, err := netlinkOps.GetLink(ifaceName)
		if err != nil {
			return errors.Wrapf(err, "failed to find device %q in netns %q",
				ifaceName, netNS.Path())
		}
		mtu = link.Attrs().MTU

		return nil
	})
	if err != nil {
		return 0, errors.Wrap(err, "failed to find MTU")
	}

	return mtu, nil
}
