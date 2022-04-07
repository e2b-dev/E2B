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

package internal

import (
	"fmt"

	"github.com/pkg/errors"
	"github.com/vishvananda/netlink"
	"golang.org/x/sys/unix"
)

// RootFilterHandle returns a u32 filter handle representing the root of the Qdisc. It's defined as
// a func so it can be immutable even though the value is retrieved through the netlink library
func RootFilterHandle() uint32 {
	return netlink.MakeHandle(0xffff, 0)
}

// NetlinkOps is an interface to the underlying low-level netlink operations that need to be performed
// by the tc-redirect-tap plugin. It helps keep the system-specific logic separate from the higher-level
// logic of the plugin. This makes writing unit tests easier and makes it easier to support multiple
// implementations of the underlying system code if the need ever arises.
//
// The interfaces support setting up a tap device whose traffic is redirected with another device
// via a U32 tc filter. More background on qdiscs, TC and the idea behind the redirect setup
// can be found here:
// * Qdiscs+filters: http://tldp.org/HOWTO/Traffic-Control-HOWTO/components.html
// * U32 Filters: http://man7.org/linux/man-pages/man8/tc-u32.8.html
// * Using u32 redirects with taps: https://gist.github.com/mcastelino/7d85f4164ffdaf48242f9281bb1d0f9b
type NetlinkOps interface {
	// CreateTap will create a tap device configured as expected by the tc-redirect-tap plugin for
	// use by a Firecracker VM. It sets the tap in the up state and with the provided MTU.
	CreateTap(name string, mtu int, ownerUID int, ownerGID int) (netlink.Link, error)

	// AddIngressQdisc adds a qdisc to the ingress queue of the provided device.
	AddIngressQdisc(link netlink.Link) error
	// GetIngressQdisc looks for an ingress qdisc matching the one added by AddIngressQdisc,
	// returning it if found. If not found, it returns a QdiscNotFoundError
	GetIngressQdisc(link netlink.Link) (netlink.Qdisc, error)
	// RemoveIngressQdisc removes the ingress qdisc added by AddIngressQdisc from the provided
	// device. It returns a QdiscNotFoundError if the expected qdisc is not attached to the
	// provided device.
	RemoveIngressQdisc(link netlink.Link) error

	// AddRedirectFilter adds a u32 redirect filter to the provided sourceLink that redirects
	// packets from its ingress queue to the egress queue of the provided targetLink. It requires
	// that sourceLink have an ingress qdisc attached prior to the call.
	AddRedirectFilter(sourceLink netlink.Link, targetLink netlink.Link) error
	// GetRedirectFilter looks for a u32 redirect filter matching the one added by
	// AddRedirectFilter, returning it if found. If not found, it returns a FilterNotFoundError
	GetRedirectFilter(sourceLink netlink.Link, targetLink netlink.Link) (netlink.Filter, error)

	// GetLink returns the netlink.Link for the device with the provided name, or a
	// LinkNotFoundError if no such device is found in the network namespace in which the call is
	// executed.
	GetLink(name string) (netlink.Link, error)
	// RemoveLink deletes the link with the provided device name. It returns LinkNotFoundError if
	// the link doesn't exist
	RemoveLink(name string) error
}

// DefaultNetlinkOps returns a standard implementation of NetlinkOps that performs the corresponding
// operations via standard netlink calls.
func DefaultNetlinkOps() NetlinkOps {
	return &defaultNetlinkOps{}
}

type defaultNetlinkOps struct{}

var _ NetlinkOps = &defaultNetlinkOps{}

func (ops defaultNetlinkOps) AddIngressQdisc(link netlink.Link) error {
	err := netlink.QdiscAdd(ops.ingressQdisc(link))
	if err != nil {
		err = errors.Wrapf(err, "failed to add ingress qdisc to device %q", link.Attrs().Name)
	}

	return err
}

func (ops defaultNetlinkOps) RemoveIngressQdisc(link netlink.Link) error {
	qdisc, err := ops.GetIngressQdisc(link)
	if err != nil {
		return err
	}

	err = netlink.QdiscDel(qdisc)
	if err != nil {
		return errors.Wrapf(err, "failed to remove ingress qdisc from device %q", link.Attrs().Name)
	}

	return nil
}

func (ops defaultNetlinkOps) GetIngressQdisc(link netlink.Link) (netlink.Qdisc, error) {
	qdiscs, err := netlink.QdiscList(link)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to list qdiscs for link %q", link.Attrs().Name)
	}

	expectedQdisc := ops.ingressQdisc(link)
	for _, qdisc := range qdiscs {
		if qdisc.Attrs().Parent == expectedQdisc.Attrs().Parent {
			return qdisc, nil
		}
	}

	return nil, &QdiscNotFoundError{device: link.Attrs().Name}
}

func (defaultNetlinkOps) ingressQdisc(link netlink.Link) netlink.Qdisc {
	return &netlink.Ingress{
		QdiscAttrs: netlink.QdiscAttrs{
			LinkIndex: link.Attrs().Index,
			Parent:    netlink.HANDLE_INGRESS,
		},
	}
}

func (ops defaultNetlinkOps) AddRedirectFilter(sourceLink netlink.Link, targetLink netlink.Link) error {
	err := netlink.FilterAdd(&netlink.U32{
		FilterAttrs: netlink.FilterAttrs{
			LinkIndex: sourceLink.Attrs().Index,
			Parent:    RootFilterHandle(),
			Protocol:  unix.ETH_P_ALL,
		},
		Actions: []netlink.Action{
			&netlink.MirredAction{
				ActionAttrs: netlink.ActionAttrs{
					Action: netlink.TC_ACT_STOLEN,
				},
				MirredAction: netlink.TCA_EGRESS_REDIR,
				Ifindex:      targetLink.Attrs().Index,
			},
		},
	})
	if err != nil {
		err = errors.Wrapf(err,
			"failed to add u32 filter redirecting from device %q to device %q, does %q exist and have a qdisc attached to its ingress?",
			sourceLink.Attrs().Name, targetLink.Attrs().Name, sourceLink.Attrs().Name)
	}

	return err
}

func (ops defaultNetlinkOps) GetRedirectFilter(sourceLink netlink.Link, targetLink netlink.Link) (netlink.Filter, error) {
	filters, err := netlink.FilterList(sourceLink, RootFilterHandle())
	if err != nil {
		return nil, errors.Wrapf(err, "failed to list filters for device %q", sourceLink.Attrs().Name)
	}

	for _, filter := range filters {
		u32Filter, ok := filter.(*netlink.U32)
		if !ok {
			continue
		}

		if u32Filter.RedirIndex == targetLink.Attrs().Index {
			return u32Filter, nil
		}
	}

	return nil, &FilterNotFoundError{device: sourceLink.Attrs().Name}
}

func (defaultNetlinkOps) GetLink(name string) (netlink.Link, error) {
	link, err := netlink.LinkByName(name)
	if _, ok := err.(netlink.LinkNotFoundError); ok {
		return nil, &LinkNotFoundError{device: name}
	}
	return link, err
}

func (ops defaultNetlinkOps) RemoveLink(name string) error {
	link, err := ops.GetLink(name)
	if err != nil {
		return err
	}

	err = netlink.LinkDel(link)
	if _, ok := err.(netlink.LinkNotFoundError); ok {
		return &LinkNotFoundError{device: link.Attrs().Name}
	}
	return err
}

func (defaultNetlinkOps) CreateTap(name string, mtu int, ownerUID, ownerGID int) (netlink.Link, error) {
	tapLinkAttrs := netlink.NewLinkAttrs()
	tapLinkAttrs.Name = name
	tapLink := &netlink.Tuntap{
		LinkAttrs: tapLinkAttrs,

		// We want a tap device (L2) as opposed to a tun (L3)
		Mode: netlink.TUNTAP_MODE_TAP,

		// Firecracker does not support multiqueue tap devices at this time:
		// https://github.com/firecracker-microvm/firecracker/issues/750
		Queues: 1,

		Flags: netlink.TUNTAP_ONE_QUEUE | // single queue tap device
			netlink.TUNTAP_VNET_HDR, // parse vnet headers added by the vm's virtio_net implementation
	}

	err := netlink.LinkAdd(tapLink)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create tap device")
	}

	for _, tapFd := range tapLink.Fds {
		err = unix.IoctlSetInt(int(tapFd.Fd()), unix.TUNSETOWNER, ownerUID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to set tap %s owner to uid %d",
				name, ownerUID)
		}

		err = unix.IoctlSetInt(int(tapFd.Fd()), unix.TUNSETGROUP, ownerGID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to set tap %s group to gid %d",
				name, ownerGID)
		}
	}

	err = netlink.LinkSetMTU(tapLink, mtu)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to set tap device MTU to %d", mtu)
	}

	err = netlink.LinkSetUp(tapLink)
	if err != nil {
		return nil, errors.Wrap(err, "failed to set tap up")
	}

	return tapLink, nil
}

type QdiscNotFoundError struct {
	device string
}

func (e QdiscNotFoundError) Error() string {
	return fmt.Sprintf("did not find expected Qdisc on device %q", e.device)
}

type FilterNotFoundError struct {
	device string
}

func (e FilterNotFoundError) Error() string {
	return fmt.Sprintf("did not find expected filter on device %q", e.device)
}

type LinkNotFoundError struct {
	device string
}

func (e LinkNotFoundError) Error() string {
	return fmt.Sprintf("did not find expected network device with name %q", e.device)
}
