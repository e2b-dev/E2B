Developing for this project
====

Testing
---

Tests are written using Go's testing framework and can be run with the standard
`go test` tool.  If you prefer to use the Makefile, `make test EXTRAGOARGS=-v`
will run tests in verbose mode. By default, the unit tests require root
privileged access. This can be disabled by setting the `DISABLE_ROOT_TESTS`
environment variable.

You need some external resources in order to run the tests, as described below:

1. A firecracker and jailer binary (tested with 0.20.0) must either be
   installed as `./testdata/firecracker` or the path must be specified through
   the `FC_TEST_BIN` environment variable. The jailer requires go test to be
   run with sudo and can also be turned off by setting the `DISABLE_ROOT_TESTS`
   env flag.
2. Access to hardware virtualization via `/dev/kvm` and `/dev/vhost-vsock`
   (ensure you have mode `+rw`!)
3. An uncompressed Linux kernel binary that can boot in Firecracker VM (Must be
   installed as `./testdata/vmlinux`)
4. A tap device owned by your userid (Must be either named `fc-test-tap0` or
   have the name specified with the `FC_TEST_TAP` environment variable; try
   `sudo ip tuntap add fc-test-tap0 mode tap user $UID` to create `fc-test-tap0`
   if you need to create one)
5. A root filesystem image installed (Must be named `testdata/root-drive.img`)
6. A secondary device image (Must be named `testdata/drive-2.img`; can be
   empty, create it something like
   `dd if=/dev/zero of=testdata/drive-2.img bs=1k count=102400`)

With all of those set up, `make test EXTRAGOARGS=-v` should create a Firecracker
process and run the Linux kernel in a MicroVM.

There is also a possibility to configure timeouts in firecracker-go-sdk,
you can set those env's to customize tests flow:
```
    FIRECRACKER_GO_SDK_INIT_TIMEOUT_SECONDS
    FIRECRACKER_GO_SDK_REQUEST_TIMEOUT_MILLISECONDS
```
You can set them directly or with a help of buildkite, otherwise default values will be used.

Regenerating the API client
---

The API client can be generated using the
[Go swagger implementation](https://goswagger.io/). To do so, perform the
following:

1. Update `client/swagger.yaml`
3. Run `go generate`
4. Figure out what broke and fix it.

Continuous Integration
---

To access `/dev/kvm`, we are using [BuildKite](https://buildkite.com/) and
Amazon EC2 Bare Metal Instances.

The instance is pre-configured to have

  - firecracker and jailer under /usr/local/bin.
    Both of them are currently v0.20.0.
  - vmlinux.bin from
    https://s3.amazonaws.com/spec.ccfc.min/img/hello/kernel/hello-vmlinux.bin
