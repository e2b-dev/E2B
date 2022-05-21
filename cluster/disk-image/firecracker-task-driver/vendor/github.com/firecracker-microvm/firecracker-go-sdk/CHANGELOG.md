# 0.22.0
* Since firecracker-microvm/firecracker#2125, `cargo build` doesn't build jailer by default. (#263)
* Fix Benchmark Goroutine (#259)
* Jailer configuration API cleanup and improved logging with Debug log level (#255)
* Firecracker is internally has an instance ID, but the SDK didn't have the way to configure the ID. This change connects Config.VMID to the instance ID. (#253)
* Fixed error that was not being test against in `TestWait` (#251)
* Fixes issue where socket path may not be defined since the config file has yet to be loaded (#230)
* Fixed error that was not being test against in `TestNewPlugin` (#225)
* Download Firecracker 0.21.1 and its jailer from Makefile (#218)

# 0.21.0
* Fixes default jailer socket and seccomp filters to be compatible with firecracker-v0.21.0 (#176)
* Fixes signal handling goroutine leak (#204)
* Machine.Wait now will wait until firecracker has stopped before returning (#182)
* Allowing passing of parsed CNI configs (#177)

# 0.20.0
* Moves the NetNS field to `Config` from `JailerConfig` (#155).
* Supports forcing CNI network creation (#130).
* Adds `FIRECRACKER_GO_SDK_INIT_TIMEOUT_SECONDS` and `FIRECRACKER_GO_SDK_REQUEST_TIMEOUT_MILLISECONDS` environment variables to configure timeouts (#165).
* Adds `ForwardSignals` to explicitly configure signal handling (#166).

# 0.19.0
* Firecracker v0.19 API: Vsock API call: PUT /vsocks/{id} changed to PUT /vsock and no longer
  appear to support multiple vsock devices. Any subsequent calls to this API
  endpoint will override the previous vsock device configuration.
* Firecracker v0.19 API: Removed 'Halting' and 'Halted' instance states.

# 0.18.0
* Adds support for configuring Network Interfaces via CNI (#126)
* Moves NetworkInterface.HostDevName and NetworkInterface.MacAddress fields to
  NetworkInterface.StaticConfiguration.HostDevName and NetworkInterface.StaticConfiguration.MacAddress
  fields, respectively. This is a backwards incompatible change, users will need
  to update the location of these fields. (#126)

# 0.17.0

* Fixes a bug where fifos were not working properly with jailer enabled (#96)
* Fixes bug where context was not being used at all during startVM (#86)
* Updates the jailer's socket path to point to the unix socket in the jailer's workspace (#86)
* Fixes bug where default socketpath would always be used when not using jailer (#84).
* Update for compatibility with Firecracker 0.17.x
* Changes JailerCfg to be a pointer and removes EnableJailer for ease of use (#110).

# 0.15.1

* Add the machine.Shutdown() method, enabling access to the SendCtrlAltDel API
  added in Firecracker 0.15.0

# 0.15.0

* Initial release
