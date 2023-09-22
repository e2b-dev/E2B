package env

import (
	"context"
	"fmt"
	"net"
	"runtime"

	"github.com/vishvananda/netlink"
	"github.com/vishvananda/netns"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/telemetry"
)

const (
	fcTapAddress        = "169.254.0.22"
	fcTapMask           = "30"
	fcTapName           = "tap0"
	namespaceNamePrefix = "fc-env-"
)

var fcTapCIDR = fmt.Sprintf("%s/%s", fcTapAddress, fcTapMask)

type FCNetwork struct {
	namespaceID string
}

func NewFCNetwork(ctx context.Context, tracer trace.Tracer, env *Env) (*FCNetwork, error) {
	network := &FCNetwork{
		namespaceID: namespaceNamePrefix + env.BuildID,
	}

	var err error

	defer func() {
		if err != nil {
			network.Cleanup(ctx, tracer)
		}
	}()

	err = network.setup(ctx, tracer)
	return network, err
}

func (n *FCNetwork) setup(ctx context.Context, tracer trace.Tracer) error {
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
		errMsg := fmt.Errorf("cannot get current (host) namespace %w", err)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "Saved original ns")
	defer func() {
		err = netns.Set(hostNS)
		if err != nil {
			errMsg := fmt.Errorf("error resetting network namespace back to the host namespace %w", err)
			telemetry.ReportError(childCtx, errMsg)
		}
		err = hostNS.Close()
		if err != nil {
			errMsg := fmt.Errorf("error closing host network namespace %w", err)
			telemetry.ReportError(childCtx, errMsg)
		}
	}()

	// Create namespace
	//   ip netns add $NS_NAME
	ns, err := netns.NewNamed(n.namespaceID)
	if err != nil {
		return fmt.Errorf("cannot create new namespace %w", err)
	}
	telemetry.ReportEvent(childCtx, "Created ns")
	defer ns.Close()

	// Create tap device
	//   ip netns exec $NS_NAME ip tuntap add name $TAP_NAME mode tap
	tapAttrs := netlink.NewLinkAttrs()
	tapAttrs.Name = fcTapName
	tapAttrs.Namespace = ns
	tap := &netlink.Tuntap{
		Mode:      netlink.TUNTAP_MODE_TAP,
		LinkAttrs: tapAttrs,
	}
	err = netlink.LinkAdd(tap)
	if err != nil {
		return fmt.Errorf("error creating tap device %w", err)
	}
	telemetry.ReportEvent(childCtx, "Created tap device")

	// Active tap device
	//   ip netns exec $NS_NAME ip link set $TAP_NAME up
	err = netlink.LinkSetUp(tap)
	if err != nil {
		return fmt.Errorf("error setting tap device up %w", err)
	}
	telemetry.ReportEvent(childCtx, "Set tap device up")

	// Add ip address to tap device
	//   ip netns exec $NS_NAME ip addr add $TAP_ADDR$TAP_MASK dev $TAP_NAME
	ip, ipNet, err := net.ParseCIDR(fcTapCIDR)
	if err != nil {
		return fmt.Errorf("error parsing tap CIDR %w", err)
	}
	telemetry.ReportEvent(childCtx, "Parsed CIDR")

	err = netlink.AddrAdd(tap, &netlink.Addr{
		IPNet: &net.IPNet{
			IP:   ip,
			Mask: ipNet.Mask,
		},
	})
	if err != nil {
		return fmt.Errorf("error setting address of the tap device %w", err)
	}
	telemetry.ReportEvent(childCtx, "Set tap device address")

	return nil
}

func (n *FCNetwork) Cleanup(ctx context.Context, tracer trace.Tracer) {
	err := netns.DeleteNamed(n.namespaceID)
	if err != nil {
		errMsg := fmt.Errorf("error deleting namespace %w", err)
		telemetry.ReportError(ctx, errMsg)
	}
	telemetry.ReportEvent(ctx, "Deleted namespace")
}
