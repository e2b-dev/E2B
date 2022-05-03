A basic Go interface to the Firecracker API
====

[![Build status](https://badge.buildkite.com/de08ca676829bedbf6de040c2c2ba1a5d2892e220997c2abdd.svg?branch=main)](https://buildkite.com/firecracker-microvm/firecracker-go-sdk)
[![GoDoc](https://godoc.org/github.com/firecracker-microvm/firecracker-go-sdk?status.svg)](https://godoc.org/github.com/firecracker-microvm/firecracker-go-sdk)

This package is a Go library to interact with the Firecracker API. It
is designed as an abstraction of the OpenAPI-generated client that
allows for convenient manipulation of Firecracker VM from Go programs.

There are some Firecracker features that are not yet supported by the
SDK.  These are tracked as GitHub issues with the
[firecracker-feature](https://github.com/firecracker-microvm/firecracker-go-sdk/issues?q=is%3Aissue+is%3Aopen+label%3Afirecracker-feature)
label . Contributions to address missing features are welcomed.

Developing
---

Please see [HACKING](HACKING.md)

Building
---

This library requires Go 1.11 and Go modules to build.  A Makefile is provided
for convenience, but is not required.  When using the Makefile, you can pass
additional flags to the Go compiler via the `EXTRAGOARGS` make variable.

Tools
---

There's a [firectl](https://github.com/firecracker-microvm/firectl/)
tool that provides a simple command-line interface to launching a
firecracker VM. It also serves as an example client of this SDK.

Network configuration
---

Firecracker, by design, only supports Linux tap devices. The SDK
provides facilities to:
* Attach a pre-created tap device, optionally with static IP configuration, to
  the VM. This is referred to as a "static network interface".
* Create a tap device via [CNI](https://github.com/containernetworking/cni) plugins, 
  which will then be attached to the VM automatically by the SDK. This is referred 
  to as a "CNI-configured network interface"
  
### CNI
If a VM is configured with a CNI-configured network interface, by default CNI configuration
files will be sought from `/etc/cni/conf.d` and CNI plugins will be sought under
`/opt/cni/bin` (both of these values can be overridden via API fields). CNI network lists
must be specified in a configuration file at this time.

It's currently highly recommended to use CNI configuration that includes
[tc-redirect-tap](https://github.com/awslabs/tc-redirect-tap) as a chained plugin.
This will allow you to adapt pre-existing CNI plugins/configuration to a tap device
usable by a Firecracker VM.

#### Example

With the following file at `/etc/cni/conf.d/fcnet.conflist`:
```
{
  "name": "fcnet",
  "cniVersion": "0.3.1",
  "plugins": [
    {
      "type": "ptp",
      "ipMasq": true,
      "ipam": {
        "type": "host-local",
        "subnet": "192.168.127.0/24",
        "resolvConf": "/etc/resolv.conf"
      }
    },
    {
      "type": "firewall"
    },
    {
      "type": "tc-redirect-tap"
    }
  ]
}
```

and the 
[`ptp`](https://github.com/containernetworking/plugins/tree/master/plugins/main/ptp), 
[`host-local`](https://github.com/containernetworking/plugins/tree/master/plugins/ipam/host-local),
[`firewall`](https://github.com/containernetworking/plugins/tree/master/plugins/meta/firewall),
and `tc-redirect-tap` CNI plugin binaries installed under `/opt/cni/bin`, you can specify,
in the Go SDK API, a `Machine` with the following `NetworkInterface`:
```go
{
  NetworkInterfaces: []firecracker.NetworkInterface{{
    CNIConfiguration: &firecracker.CNIConfiguration{
      NetworkName: "fcnet",
      IfName: "veth0",
    },
  }}
}
```

Note that `NetworkName` in the `CNIConfiguration` of the API matches the `name` field 
specified inside the `/etc/cni/conf.d/fcnet.conflist` file.

With the above configuration, when the Firecracker VM is started the SDK will invoke
CNI and place the final VM inside the resultant network namespace. The end result being:
* Outside the network namespace, a single veth endpoint created by the `ptp` plugin will
  exist with a static IP from the `host-local` plugin (i.e. `192.168.127.1`)
  * Users can obtain the IP address and other static network configuration generated for
    their machine via CNI by inspecting the network interface's `StaticConfiguration`
    field, which will be automatically filled out after the machine has been started.
  * The IP address, for example, can be obtained at
    `NetworkInterfaces[0].StaticConfiguration.IPConfiguration.IPAddr` after a call to the
    machine object's `Start` method succeeds.
* Inside the VM's network namespace:
    * The other side of the veth device will exist with name `veth0`, as specified by the
      `IfName` parameter above, and a different IP (i.e. `192.168.127.2`)
    * The tap device created by `tc-redirect-tap`, which will not have an IP but will have
      all of its traffic mirrored with the `veth0` device
* Inside the actual Firecracker VM guest:
    * A network interface with the same IP as that of `veth0` (i.e. `192.168.127.2`)
    * Traffic sent on this device will be mirrored with the external `veth0` device,
      so from a practical perspective the VM's internal network interface will externally
      appear the same as `veth0`
    * The internal name of the interface is determined by the Guest OS, not the Firecracker
      Go SDK.

Note that the `ptp` and `host-local` plugins are not required, they are just used in this
example. The `tc-redirect-tap` plugin can be chained after any CNI plugin that creates a
network interface. It will setup the tap device to be mirrored with the `IfName` device
created by any previous plugin. Any IP configuration on that `IfName` device will be
applied statically to the VM's internal network interface on boot.

Also note that use of CNI-configured network interfaces will require the SDK to be running with at least
`CAP_SYS_ADMIN` and `CAP_NET_ADMIN` Linux capabilities (in order to have the 
ability to create and configure network namespaces).

### Network Setup Limitations
These limitations are a result of the current implementation and may be lifted in the future:
* For a given VM, if a CNI-configured network interface is specified or a static interface
  that includes IP configuration is specified, the VM can only have a single
  network interface, not multiple.
  * Users can specify multiple static interfaces as long as none of them 
    include IP configuration.
* DNS nameserver settings will only be effective if the VM's rootfs makes
  `/etc/resolv.conf` be a symlink to `/proc/net/pnp`.
* Only up to 2 DNS nameservers can be configured within the VM internally.
  * If a static network interface specifies more than 2, an error will be 
    returned.
  * If a CNI-configured network interface receives more than 2 nameservers from the CNI 
    invocation result, the nameservers after the second will be ignored without 
    error (in order to be compatible with pre-existing CNI plugins/configuration).

Questions?
---

Please use
[GitHub issues](https://github.com/firecracker-microvm/firecracker-go-sdk/issues)
to report problems, discuss roadmap items, or make feature requests.

If you've discovered an issue that may have security implications to
users or developers of this software, please do not report it using
GitHub issues, but instead follow
[Firecracker's security reporting guidelines](https://github.com/firecracker-microvm/firecracker/blob/main/SECURITY.md).

Other discussion: For general discussion, please join us in the
`#general` channel on the [Firecracker Slack](https://join.slack.com/t/firecracker-microvm/shared_invite/zt-oxbm7tqt-GLlze9zZ7sdRSDY6OnXXHg).

License
====

This library is licensed under the Apache 2.0 License. 
