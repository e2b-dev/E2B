# windows-nested — a Windows desktop inside an E2B sandbox (experimental)

**Status: experimental.** This template is a working proof of concept, not a supported
product feature. It runs on a self-hosted [E2B Local](https://github.com/e2b-dev/infra-local)
stack with the changes listed under Prerequisites; it does not build on E2B Cloud today.
Numbers below come from one lab host at three levels of virtualization and are not a
performance promise.

The sandbox is a Debian 12 Linux VM, as always. Inside it, QEMU/KVM boots a pre-installed
Windows disk; noVNC serves the Windows console over HTTP on port 6080 and Windows answers
RDP on port 3389. Nothing in the E2B platform changes: the whole thing is a template with a
start command.

```
templates/windows-nested/
├── e2b.Dockerfile        Debian 12 + qemu-system-x86 + noVNC + the Windows disk + win/
├── win/                  scripts that run inside the sandbox
│   ├── qemu-common.sh    the QEMU command line (env: WIN_MEM, WIN_SMP, WIN_RDP_PORT, WIN_DIR)
│   ├── build-snapshot.sh relaunch mode: build-time boot, RDP wait, `savevm`, quit
│   ├── winctl.py         relaunch mode: start command, relaunches Windows on sandbox start
│   ├── start-live.sh     live mode: start command, boots Windows and leaves it running
│   ├── rdpcheck.py       X.224 RDP liveness probe (a TCP connect is not enough behind QEMU's hostfwd)
│   └── qmp.py            minimal QMP client (savevm, quit, screendump)
├── template.py           template definition, Python SDK
├── template.ts           template definition, JavaScript SDK
└── image/                build-disk.sh + README: producing the Windows disk (never committed)
```

## Prerequisites

1. **A guest kernel with KVM built in.** Stock E2B sandbox kernels do not enable
   `CONFIG_KVM_INTEL`, so a sandbox has no `/dev/kvm` and the `vmx` CPU flag is masked. The
   kernel has to be rebuilt from infra's `packages/fc-kernels` with
   `CONFIG_VIRTUALIZATION=y CONFIG_KVM=y CONFIG_KVM_INTEL=y` (the only config change),
   installed next to the stock kernels, and selected for the build (`DEFAULT_KERNEL_VERSION`
   on E2B Local; the `build-kernel-version` feature flag in the platform). VMX itself passes
   through Firecracker with no CPU template. Nested virtualization must be on in the host
   (`kvm_intel nested=Y`).
2. **A registry the template builder can pull from.** The image built from `e2b.Dockerfile`
   is about 10 GB. Sandboxes cannot reach RFC 1918 addresses, but the template builder runs
   in the host network and can, so on E2B Local a plain registry on the bridge address works
   (push with `skopeo copy --dest-tls-verify=false`; Docker's own push insists on TLS).
3. **Sandbox size and disk.** 8 vCPU and 8 GiB (6 GiB is enough when Windows gets 4 GiB); the
   template's free disk has to fit the Windows disk plus, in relaunch mode, the saved guest memory
   (about 2.3 GiB): 16 GB of free disk in the tier is comfortable. The **node** needs about 40 GB
   free per build (base layer, RUN layer and memory snapshots of a 26 GB rootfs); a build that
   fills the node's disk takes the orchestrator down with it.
4. **Hugepages on the node** for an 8 GiB sandbox: an 8 GiB memfd cannot be mapped from the
   stock E2B Local 4 GiB pool (`uffd ... mmap memfd: cannot allocate memory`).
5. **The Windows disk** — see [image/README.md](image/README.md). Evaluation media only, with
   the licence limits that implies.

Live mode adds two more (below).

## Two modes

| | relaunch (default) | live |
|---|---|---|
| what the snapshot holds | Linux only; Windows saved with QEMU's own `savevm` at build time | a live nested VM: QEMU with Windows running |
| start command | `winctl.py` waits for the sandbox start and runs `qemu -loadvm win` | `start-live.sh` cold-boots Windows; the ready command is the RDP probe |
| Firecracker | stock | a build that saves and restores KVM nested state (`KVM_GET/SET_NESTED_STATE`); not in any release |
| guest kernel | KVM-enabled | KVM-enabled **and** booted with `no-kvmapf` (built-in command line, or the `build-kernel-cmdline-args` feature flag) |
| RDP answers after `Sandbox.create()` | **4.4–8.4 s** (see Measured) | **0.8–1.5 s** |
| pause / resume | not safe: Firecracker drops the nested VM's state; Windows in the old QEMU is dead after resume and is not relaunched | works; RDP back about 1.4 s after `connect` |
| build time | 6.5–10 min, of which Windows cold boot to RDP is about 5 min | about 8.5 min |

**Relaunch mode** exists because stock Firecracker does not save KVM nested (VMX) state: a
snapshot taken while QEMU runs restores to a guest kernel panic. So the build boots Windows
once, waits for a real RDP answer, takes a QEMU internal snapshot (`savevm win`, about 2.3 GiB
of non-zero guest pages into the qcow2) and quits QEMU before the sandbox snapshot is taken.
On every sandbox start `winctl.py` notices the start and launches a fresh QEMU with
`-loadvm win`. The start signal is the jump in `CLOCK_REALTIME - CLOCK_MONOTONIC`: envd sets
the wall clock to host time on every start while the monotonic clock continues from the
snapshot, so the offset jumps by exactly the time the template spent frozen. It fires within
0.1 s of `create()`. `touch /opt/win/start-now` from `sandbox.commands.run` is the fallback.

**Live mode** leaves Windows running through the Firecracker snapshot, so a sandbox comes up
with Windows already there. It was verified on 2026-09-08 with a nested-state Firecracker
build plus `no-kvmapf` in the guest kernel command line (E2B's internal experiment report
`ASYNC-PF-RESULT.md`): four of four sandboxes resumed with the build-time QEMU process still
running, RDP answering 0.84–1.54 s after `create()`, pause and resume kept the same QEMU with
RDP back 1.36 s after `connect()`, and the guest kernel logged nothing. Without `no-kvmapf` the
resumed guest panics with `Host injected async #PF in kernel mode` (E2B's lazy memory restore
meets KVM's paravirtual async page faults on a vCPU that has been in nested-guest mode);
without the nested-state Firecracker it panics in `kvm_spurious_fault`. Neither piece is in
a released Firecracker or in the E2B Cloud, which is why live mode is documented here and not
re-verified by the relaunch-mode steps below.

## Build

```sh
cd templates/windows-nested
WIN_PASSWORD='...' image/build-disk.sh                      # once, on a KVM host: image/{win.qcow2,OVMF_CODE.fd,OVMF_VARS.qcow2}
docker build -f e2b.Dockerfile -t REGISTRY/windows-nested:1 .
docker save REGISTRY/windows-nested:1 -o /tmp/wn.tar && skopeo copy --dest-tls-verify=false docker-archive:/tmp/wn.tar docker://REGISTRY/windows-nested:1

python template.py REGISTRY/windows-nested:1 windows-nested                 # relaunch mode, 8 vCPU / 8192 MB
python template.py REGISTRY/windows-nested:1 windows-nested-live --mode live
npx tsx template.ts REGISTRY/windows-nested:1 windows-nested                # same, JavaScript SDK
```

`template.py` and `template.ts` take the image reference and the template name, plus
`--mode relaunch|live`, `--cpu`, `--memory-mb` and `--skip-cache` (rebuild the `savevm`
layer even when the image reference did not change). The Dockerfile's `COPY` sources are
build args (`WIN_DISK`, `OVMF_CODE`, `OVMF_VARS`) for a disk kept elsewhere.

## Use

```python
from e2b import Sandbox

sbx = Sandbox.create(template="windows-nested", timeout=1800)
print(f"https://{sbx.get_host(6080)}/vnc.html")   # noVNC, the Windows console in a browser
sbx.commands.run("python3 /opt/win/rdpcheck.py")  # "rdp up" once Windows answers
```

- **noVNC** is the browser path: `get_host(6080)` goes through the sandbox HTTP proxy. In
  relaunch mode the page is up about 0.5 s after RDP; before that the console is blank.
- **RDP** is TCP on port 3389 inside the sandbox. The sandbox proxy is HTTP-only, so an RDP
  client needs its own TCP path into the sandbox (a tunnel through a command in the sandbox,
  or a client run inside it); the local administrator is the one baked in by `build-disk.sh`.
- `/opt/win/state.json` (relaunch) and `/opt/win/heartbeat` (live) carry the start command's
  timeline: `resume_detected`, `qemu_started`, `rdp_up`.

## Measured

Relaunch mode, E2B Local on one bare-metal host. Windows there is a third-level guest
(host → E2B Local VM → Firecracker sandbox → QEMU), the same depth as a cloud VM node. `t = 0`
is the `Sandbox.create()` call; in-sandbox stamps are wall-clock after envd set the guest clock.

| run | sandbox up (envd) | start detected | QEMU `-loadvm` started | RDP answers (X.224) | in-sandbox `rdpcheck.py` | noVNC `/vnc.html` 200 via `get_host(6080)` |
|---|---|---|---|---|---|---|
| 1 | 0.10 s | 0.11 s | 0.12 s | **4.73 s** | up @ 6.22 s | 200 @ 6.27 s |
| 2 | 0.07 s | 0.07 s | 0.08 s | **4.40 s** | up @ 5.62 s | 200 @ 5.64 s |
| 3 | 0.09 s | 0.11 s | 0.11 s | **4.48 s** | up @ 5.54 s | 200 @ 5.55 s |

Three consecutive sandboxes from the same build, quiet host (2026-09-08). The probe and noVNC
columns are when the sequential test script got round to them, not when the service came up.

Build of the same template: Windows cold boot to RDP 290–292 s at this nesting depth
(6.2 s on the bare host with the same QEMU arguments), `savevm` 2–3 s, whole build
6 m 36 s with the 10 GB base layer already cached (about 10 min when the image is pulled first). The PoC that this template generalises measured 5.0–8.4 s to RDP over six
sandboxes and 16 s under CPU contention from a concurrent build.

Footprint per running Windows sandbox: about 2.5 GiB of hugepages resident on the node
(Windows' 1 GiB of non-zero pages after `-loadvm`, Debian, page cache); the sandbox's 8 GiB
is reserved, not resident.

## Known limits

- **Not sub-second, not on E2B Cloud.** Relaunch mode restores 2.3 GiB of guest memory on
  every create and pays the nested-virtualization tax: the warm path is 4–6× the bare-host
  number, cold boot about 50×. The prerequisites are not available on E2B Cloud today.
- **Pause is unsafe in relaunch mode** and `winctl.py` does not relaunch Windows after a second
  start. Live mode handles pause, but on a 26 GB-rootfs template the orchestrator's rootfs
  export on pause timed out 2 of 3 times on E2B Local — a template-size limit, not a
  Windows one.
- **Long-running stability is unproven.** The longest hold measured was a few minutes; one
  early run (with a different Hyper-V enlightenment set, since replaced) stalled after 25 min.
- **`savevm` stores the vmstate in the first snapshot-capable drive**, which is
  `OVMF_VARS.qcow2` here. Harmless; both files live in `/opt/win`.
- **Licence.** Evaluation media, 180-day trial, unactivated. See `image/README.md`.
