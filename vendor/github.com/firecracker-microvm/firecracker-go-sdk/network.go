// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

package firecracker

import (
	"context"
	"net"
	"os"
	"path/filepath"
	"runtime"

	"github.com/containernetworking/cni/libcni"
	"github.com/containernetworking/cni/pkg/types"
	"github.com/containernetworking/cni/pkg/types/current"
	"github.com/containernetworking/plugins/pkg/ns"
	"github.com/pkg/errors"
	log "github.com/sirupsen/logrus"
	"golang.org/x/sys/unix"

	models "github.com/firecracker-microvm/firecracker-go-sdk/client/models"
	"github.com/firecracker-microvm/firecracker-go-sdk/cni/vmconf"
)

const (
	defaultCNIBinDir   = "/opt/cni/bin"
	defaultCNIConfDir  = "/etc/cni/conf.d"
	defaultCNICacheDir = "/var/lib/cni"
)

// NetworkInterfaces is a slice of NetworkInterface objects that a VM will be
// configured to use.
type NetworkInterfaces []NetworkInterface

func (networkInterfaces NetworkInterfaces) validate(kernelArgs kernelArgs) error {
	for _, iface := range networkInterfaces {
		hasCNI := iface.CNIConfiguration != nil
		hasStaticInterface := iface.StaticConfiguration != nil
		hasStaticIP := hasStaticInterface && iface.StaticConfiguration.IPConfiguration != nil

		if !hasCNI && !hasStaticInterface {
			return errors.Errorf(
				"must specify at least one of CNIConfiguration or StaticConfiguration for network interfaces: %+v", networkInterfaces)
		}

		if hasCNI && hasStaticInterface {
			// TODO(sipsma) in theory, the current code actually supports the user providing both CNI and StaticConfiguration
			// for a single interface. The behavior would be that CNI is invoked but the final device used would be
			// specified statically rather than parsed from the CNI result via vmconf.
			// This may be useful in some scenarios, but the full implications of enabling it have not yet been considered or
			// tested, so for now providing both is blocked to prevent any regrettable one-way doors.
			return errors.Errorf(
				"cannot provide both CNIConfiguration and StaticConfiguration for a network interface: %+v", iface)
		}

		if hasCNI || hasStaticIP {
			// due to limitations of using "ip=" kernel boot param, currently only one network interface can be provided
			// when a static IP is going to be configured.
			if len(networkInterfaces) > 1 {
				return errors.Errorf(
					"cannot specify CNIConfiguration or IPConfiguration when multiple network interfaces are provided: %+v", networkInterfaces)
			}

			if argVal, ok := kernelArgs["ip"]; ok {
				return errors.Errorf(
					`CNIConfiguration or IPConfiguration cannot be specified when "ip=" provided in kernel boot args, value found: "%v"`, argVal)
			}
		}

		if hasCNI {
			err := iface.CNIConfiguration.validate()
			if err != nil {
				return err
			}
		}

		if hasStaticInterface {
			err := iface.StaticConfiguration.validate()
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// setupNetwork will invoke CNI if needed for any interfaces
func (networkInterfaces NetworkInterfaces) setupNetwork(
	ctx context.Context,
	vmID string,
	netNSPath string,
	logger *log.Entry,
) (error, []func() error) {
	var cleanupFuncs []func() error

	// Get the network interface with CNI configuration or, if there is none,
	// just return right away.
	cniNetworkInterface := networkInterfaces.cniInterface()
	if cniNetworkInterface == nil {
		return nil, cleanupFuncs
	}

	cniNetworkInterface.CNIConfiguration.containerID = vmID
	cniNetworkInterface.CNIConfiguration.netNSPath = netNSPath
	cniNetworkInterface.CNIConfiguration.setDefaults()

	// Make sure the netns is setup. If the path doesn't yet exist, it will be
	// initialized with a new empty netns.
	err, netnsCleanupFuncs := cniNetworkInterface.CNIConfiguration.initializeNetNS()
	cleanupFuncs = append(cleanupFuncs, netnsCleanupFuncs...)
	if err != nil {
		return errors.Wrap(err, "failed to initialize netns"), cleanupFuncs
	}

	cniResult, err, cniCleanupFuncs := cniNetworkInterface.CNIConfiguration.invokeCNI(ctx, logger)
	cleanupFuncs = append(cleanupFuncs, cniCleanupFuncs...)
	if err != nil {
		return errors.Wrap(err, "failure when invoking CNI"), cleanupFuncs
	}

	// If static configuration is not already set for the network device, fill it out
	// by parsing the CNI result object according to the specifications detailed in the
	// vmconf package docs.
	if cniNetworkInterface.StaticConfiguration == nil {
		vmNetConf, err := vmconf.StaticNetworkConfFrom(*cniResult, cniNetworkInterface.CNIConfiguration.containerID)
		if err != nil {
			return errors.Wrap(err,
				"failed to parse VM network configuration from CNI output, ensure CNI is configured with a plugin "+
					"that supports automatic VM network configuration such as tc-redirect-tap",
			), cleanupFuncs
		}

		cniNetworkInterface.StaticConfiguration = &StaticNetworkConfiguration{
			HostDevName: vmNetConf.TapName,
			MacAddress:  vmNetConf.VMMacAddr,
		}

		if vmNetConf.VMIPConfig != nil {
			if len(vmNetConf.VMNameservers) > 2 {
				logger.Warnf("more than 2 nameservers provided from CNI result, only the first 2 %+v will be applied",
					vmNetConf.VMNameservers[:2])
				vmNetConf.VMNameservers = vmNetConf.VMNameservers[:2]
			}

			cniNetworkInterface.StaticConfiguration.IPConfiguration = &IPConfiguration{
				IPAddr:      vmNetConf.VMIPConfig.Address,
				Gateway:     vmNetConf.VMIPConfig.Gateway,
				Nameservers: vmNetConf.VMNameservers,
			}
		}
	}

	return nil, cleanupFuncs
}

// return the network interface that has CNI configuration, or nil if there is no such interface
func (networkInterfaces NetworkInterfaces) cniInterface() *NetworkInterface {
	// Validation that there is at most one CNI interface is done as part of the
	// NetworkConfigValidationHandler, can safely just use the first result
	// here and assume it's the only one.
	for i, iface := range networkInterfaces {
		if iface.CNIConfiguration != nil {
			return &networkInterfaces[i]
		}
	}

	return nil
}

// return the network interface that has static IP configuration, or nil if there is no such interface
func (networkInterfaces NetworkInterfaces) staticIPInterface() *NetworkInterface {
	// Validation that there is at most one interface with StaticIPConfiguration
	// is done as part of the NetworkConfigValidationHandler, can safely just use
	// the first result here and assume it's the only one.
	for i, iface := range networkInterfaces {
		if iface.StaticConfiguration == nil {
			continue
		}

		if iface.StaticConfiguration.IPConfiguration != nil {
			return &networkInterfaces[i]
		}
	}

	return nil
}

// NetworkInterface represents a Firecracker microVM's network interface.
// It can be configured either with static parameters set via StaticConfiguration
// or via CNI as set via CNIConfiguration. It is currently an error to specify
// both static and CNI configuration.
type NetworkInterface struct {
	// StaticConfiguration parameters that will be used to configure the VM's
	// tap device and internal network for this network interface.
	StaticConfiguration *StaticNetworkConfiguration

	// CNIConfiguration that will be used to generate the VM's network namespace,
	// tap device and internal network for this network interface.
	CNIConfiguration *CNIConfiguration

	// AllowMMDS makes the Firecracker MMDS available on this network interface.
	AllowMMDS bool

	// InRateLimiter limits the incoming bytes.
	InRateLimiter *models.RateLimiter

	// OutRateLimiter limits the outgoing bytes.
	OutRateLimiter *models.RateLimiter
}

// CNIConfiguration specifies the CNI parameters that will be used to generate
// the network namespace and tap device used by a Firecracker interface.
//
// Currently, CNIConfiguration can only be specified for VMs that have a
// single network interface.
type CNIConfiguration struct {
	// NetworkName (required) corresponds to the "name" parameter in the
	// CNI spec's Network Configuration List structure. It selects the name
	// of the network whose configuration will be used when invoking CNI.
	NetworkName string

	// IfName (optional) corresponds to the CNI_IFNAME parameter as specified
	// in the CNI spec. It generally specifies the name of the interface to be
	// created by a CNI plugin being invoked.
	//
	// Note that this does NOT necessarily correspond to the name of the
	// tap device the Firecracker VM will use as the tap device may be
	// created by a chained plugin that adapts the tap to a pre-existing
	// network device (which will by the one with "IfName").
	IfName string

	// Args (optional) corresponds to the CNI_ARGS parameter as specified in
	// the CNI spec. It allows custom args to be passed to CNI plugins during
	// invocation.
	Args [][2]string

	// BinPath (optional) is a list of directories in which CNI plugin binaries
	// will be sought. If not provided, defaults to just "/opt/bin/CNI"
	BinPath []string

	// ConfDir (optional) is the directory in which CNI configuration files
	// will be sought. If not provided, defaults to "/etc/cni/conf.d"
	ConfDir string

	// CacheDir (optional) is the director in which CNI queries/results will be
	// cached by the runtime. If not provided, defaults to "/var/lib/cni"
	CacheDir string

	// containerID corresponds to the CNI_CONTAINERID parameter as
	// specified in the CNI spec. It is private to CNIConfiguration
	// because we expect users to provide it via the Machine's VMID parameter
	// (or otherwise be randomly generated if the VMID was unset by the user)
	containerID string

	// netNSPath is private to CNIConfiguration because we expect users to
	// either provide the netNSPath via the Jailer config or allow the
	// netns path to be autogenerated by us.
	netNSPath string
}

func (cniConf CNIConfiguration) validate() error {
	if cniConf.NetworkName == "" {
		return errors.Errorf("must specify NetworkName in CNIConfiguration: %+v", cniConf)
	}

	return nil
}

func (cniConf *CNIConfiguration) setDefaults() {
	if len(cniConf.BinPath) == 0 {
		cniConf.BinPath = []string{defaultCNIBinDir}
	}

	if cniConf.ConfDir == "" {
		cniConf.ConfDir = defaultCNIConfDir
	}

	if cniConf.CacheDir == "" {
		cniConf.CacheDir = filepath.Join(defaultCNICacheDir, cniConf.containerID)
	}
}

func (cniConf CNIConfiguration) asCNIRuntimeConf() *libcni.RuntimeConf {
	return &libcni.RuntimeConf{
		ContainerID: cniConf.containerID,
		NetNS:       cniConf.netNSPath,
		IfName:      cniConf.IfName,
		Args:        cniConf.Args,
	}
}

func (cniConf CNIConfiguration) invokeCNI(ctx context.Context, logger *log.Entry) (*types.Result, error, []func() error) {
	var cleanupFuncs []func() error

	cniPlugin := libcni.NewCNIConfigWithCacheDir(cniConf.BinPath, cniConf.CacheDir, nil)

	networkConf, err := libcni.LoadConfList(cniConf.ConfDir, cniConf.NetworkName)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to load CNI configuration from dir %q for network %q",
			cniConf.ConfDir, cniConf.NetworkName), cleanupFuncs
	}

	runtimeConf := cniConf.asCNIRuntimeConf()

	delNetworkFunc := func() error {
		err := cniPlugin.DelNetworkList(ctx, networkConf, runtimeConf)
		if err != nil {
			return errors.Wrapf(err, "failed to delete CNI network list %q", cniConf.NetworkName)
		}
		return nil
	}

	// Try deleting the network in case it already exists, which can happen if there is
	// a crash before cleanup from a previous invocations. If it doesn't exist,
	// well-behaved CNI plugins should treat this as a no-op without returning an error
	// (resulting also in a nil error here).
	// We can be reasonably sure any previous VM that was using this network is gone due
	// to earlier validation that the VM's socket path does not already exist.
	err = delNetworkFunc()
	if err != nil {
		// something actually went wrong deleting the network, return an error so we don't
		// try to create a new network on top of a possibly half-deleted previous one.
		return nil, errors.Wrapf(err,
			"failed to delete pre-existing CNI network %+v", cniConf), cleanupFuncs
	}

	// Append cleanup of the network list before calling AddNetworkList to handle
	// case where AddNetworkList fails but leaves intermediate resources around like
	// devices and ip allocations.
	cleanupFuncs = append(cleanupFuncs, delNetworkFunc)
	cniResult, err := cniPlugin.AddNetworkList(ctx, networkConf, runtimeConf)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create CNI network"), cleanupFuncs
	}

	return &cniResult, nil, cleanupFuncs
}

// initializeNetNS checks to see if the netNSPath already exists, if it doesn't it will create
// a new one mounted at that path.
func (cniConf CNIConfiguration) initializeNetNS() (error, []func() error) {
	var cleanupFuncs []func() error

	err := ns.IsNSorErr(cniConf.netNSPath)
	switch err.(type) {
	case nil:
		// if the path already exists and is a netns, just use it as is and return early
		return nil, cleanupFuncs
	case ns.NSPathNotNSErr:
		// if the path exists but isn't a netns, return an error
		return errors.Wrapf(err, "path %q does not appear to be a mounted netns", cniConf.netNSPath), cleanupFuncs
	case ns.NSPathNotExistErr:
		// if the path doesn't exist, continue on to creating a new netns at the path
	default:
		// if something else bad happened return the error
		return errors.Wrapf(err, "failure checking if %q is a mounted netns", cniConf.netNSPath), cleanupFuncs
	}

	// the path doesn't exist, so we need to create a new netns and mount it at the path

	// make sure the parent directory for the path exists
	parentDir := filepath.Dir(cniConf.netNSPath)
	_, err = os.Stat(parentDir)
	if os.IsNotExist(err) {
		err = os.MkdirAll(parentDir, 0600)
		if err != nil {
			return errors.Wrapf(err, "failed to create netns parent dir at %q", parentDir), cleanupFuncs
		}

		cleanupFuncs = append(cleanupFuncs, func() error {
			// Use Remove, not RemoveAll, so we don't clear the directory in the
			// case where something else ended up creating files in the directory
			// concurrently with us.
			err := os.Remove(parentDir)
			if err != nil {
				return errors.Wrapf(err, "failed to remove netns parent dir %q", parentDir)
			}
			return nil
		})
	} else if err != nil {
		return errors.Wrapf(err, "failed to check if netns parent dir exists at %q", parentDir), cleanupFuncs
	}

	// We need a file to exist at the path in order for the bind mount to succeed.
	fd, err := os.OpenFile(cniConf.netNSPath, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return errors.Wrapf(err,
			"failed to open new netns path at %q", cniConf.netNSPath), cleanupFuncs
	}
	fd.Close()

	cleanupFuncs = append(cleanupFuncs, func() error {
		err := os.Remove(cniConf.netNSPath)
		if err != nil {
			return errors.Wrapf(err, "failed to remove netns path %q", cniConf.netNSPath)
		}
		return nil
	})

	// Create a new netns and mount it at the destination path. Doing this in a
	// separate OS thread that's discarded at the end of the call is the
	// simplest way to prevent the namespace from leaking to other goroutines.
	doneCh := make(chan error)
	go func() {
		defer close(doneCh)
		// Lock the goroutine to the OS thread but don't ever unlock it. When
		// this func finishes execution the OS thread will just be discarded.
		runtime.LockOSThread()

		// create a new net ns
		err := unix.Unshare(unix.CLONE_NEWNET)
		if err != nil {
			doneCh <- errors.Wrap(err, "failed to unshare netns")
			return
		}

		// mount the new netns at the destination path
		err = unix.Mount("/proc/thread-self/ns/net", cniConf.netNSPath, "none", unix.MS_BIND, "none")
		if err != nil {
			doneCh <- errors.Wrapf(err, "failed to mount netns at path %q", cniConf.netNSPath)
			return
		}

		cleanupFuncs = append(cleanupFuncs, func() error {
			err := unix.Unmount(cniConf.netNSPath, unix.MNT_DETACH)
			if err != nil {
				return errors.Wrapf(err, "failed to unmount netns at %q", cniConf.netNSPath)
			}
			return nil
		})
	}()

	err = <-doneCh
	return err, cleanupFuncs
}

// StaticNetworkConfiguration allows a network interface to be defined via static parameters
// (as contrasted with parameters autogenerated from CNI).
type StaticNetworkConfiguration struct {
	// MacAddress defines the MAC address that should be assigned to the network
	// interface inside the microVM.
	MacAddress string

	// HostDevName is the name of the tap device the VM will use
	HostDevName string

	// IPConfiguration (optional) allows a static IP, gateway and up to 2 DNS nameservers
	// to be automatically configured within the VM upon startup.
	IPConfiguration *IPConfiguration
}

func (staticConf StaticNetworkConfiguration) validate() error {
	if staticConf.HostDevName == "" {
		return errors.Errorf(
			"HostDevName must be provided if StaticNetworkConfiguration is provided: %+v", staticConf)
	}

	if staticConf.IPConfiguration != nil {
		err := staticConf.IPConfiguration.validate()
		if err != nil {
			return err
		}
	}

	return nil
}

// IPConfiguration specifies an IP, a gateway and DNS Nameservers that should be configured
// automatically within the VM upon boot. It currently only supports IPv4 addresses.
//
// IPConfiguration can currently only be specified for VM's with a single network interface.
// The IPAddr and Gateway will be used to assign an IP a a default route for the VM's internal
// interface.
//
// The first 2 nameservers will be configured in the /proc/net/pnp file in a format
// compatible with /etc/resolv.conf (any further nameservers are currently ignored). VMs that
// wish to use the nameserver settings here will thus typically need to make /etc/resolv.conf
// a symlink to /proc/net/pnp
type IPConfiguration struct {
	IPAddr      net.IPNet
	Gateway     net.IP
	Nameservers []string
}

func (ipConf IPConfiguration) validate() error {
	// Make sure only ipv4 is being provided (for now).
	for _, ip := range []net.IP{ipConf.IPAddr.IP, ipConf.Gateway} {
		if ip.To4() == nil {
			return errors.Errorf("invalid ip, only ipv4 addresses are supported: %+v", ip)
		}
	}

	if len(ipConf.Nameservers) > 2 {
		return errors.Errorf("cannot specify more than 2 nameservers: %+v", ipConf.Nameservers)
	}

	return nil
}

func (conf IPConfiguration) ipBootParam() string {
	// the vmconf package already has a function for doing this, just re-use it
	vmConf := vmconf.StaticNetworkConf{
		VMNameservers: conf.Nameservers,
		VMIPConfig: &current.IPConfig{
			Version: "4",
			Address: conf.IPAddr,
			Gateway: conf.Gateway,
		},
	}

	return vmConf.IPBootParam()
}
