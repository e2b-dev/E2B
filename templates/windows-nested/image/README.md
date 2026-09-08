# Windows disk for the windows-nested template

`e2b.Dockerfile` copies three files from this directory, none of which are
committed (see `.gitignore`):

| file | what |
|---|---|
| `win.qcow2` | the installed Windows system disk, qcow2, zstd-compressed (about 10 GB for a 32 GiB virtual disk) |
| `OVMF_CODE.fd` | UEFI firmware code the install booted with (read-only pflash) |
| `OVMF_VARS.qcow2` | UEFI variables holding the "Windows Boot Manager" entry, as qcow2 so QEMU `savevm` accepts the drive |

`build-disk.sh` produces them with [dockur/windows](https://github.com/dockur/windows),
which downloads the installer from Microsoft and runs an unattended install under
KVM. It needs a Linux host with `/dev/kvm`, Docker, `qemu-img`, `python3`, about
20 GB of free disk and roughly 15 to 30 minutes, most of it the ISO download and
the install.

```sh
WIN_PASSWORD='choose-one' ./build-disk.sh
```

The script waits until the installed Windows answers RDP (that is when the unattended
install, first logon and the auto-configured RDP are all done), lets it settle,
shuts it down over ACPI, and converts the raw disk. You can watch the install in a
browser at `http://127.0.0.1:8006` on the host while it runs.

Settings, all environment variables with defaults:

| variable | default | notes |
|---|---|---|
| `WIN_VERSION` | `2025` | dockur version code; `2025` is Windows Server 2025, `11` is Windows 11. Server needs no TPM, which is what the template's QEMU configuration assumes |
| `WIN_USERNAME` / `WIN_PASSWORD` | `e2b` / required | local administrator baked into the disk; auto-logon and RDP are enabled by dockur |
| `WIN_DISK_SIZE` | `32G` | virtual size; the qcow2 only stores used blocks |
| `WIN_RAM_SIZE` / `WIN_CPU_CORES` | `6G` / `4` | install-time sizing; the template boots the disk with `WIN_MEM=4096` and `WIN_SMP=4` (see `win/qemu-common.sh`) |
| `DOCKUR_WEB_PORT` / `DOCKUR_RDP_PORT` | `8006` / `3389` | loopback ports for the installer's web view and for the RDP readiness probe |
| `WIN_INSTALL_TIMEOUT` / `WIN_SETTLE` | `7200` / `180` | seconds |

The disk is installed with the virtio drivers dockur ships: virtio-scsi system disk,
virtio-net, virtio VGA, USB tablet. `win/qemu-common.sh` presents the same devices, so the
disk boots unchanged inside the sandbox.

## Licence

dockur downloads **evaluation media**: a 180-day trial, unactivated. That is fine for
trying this template out and it is not a licence to run Windows in production. Bring
your own licensing and media before using this for anything else, and never commit or
publish the disk you produce.
