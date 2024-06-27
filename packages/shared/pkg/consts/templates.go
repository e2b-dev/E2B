package consts

const (
	EnvsDisk = "/mnt/disks/fc-envs/v1"

	KernelsDir     = "/fc-kernels"
	KernelMountDir = "/fc-vm"
	KernelName     = "vmlinux.bin"

	HostEnvdPath    = "/fc-vm/envd"
	HostEnvdV2Path  = "/fc-vm/envd-v2"
	GuestEnvdPath   = "/usr/bin/envd"
	GuestEnvdV2Path = "/usr/bin/envd-v2"

	EnvdVersionKey = "envd_version"
	RootfsSizeKey  = "rootfs_size"

	FirecrackerVersionsDir = "/fc-versions"
	FirecrackerBinaryName  = "firecracker"
)
