#!/bin/bash
# Produce the Windows disk and UEFI firmware pair that e2b.Dockerfile copies:
# an unattended dockur/windows install on a KVM host, shut down cleanly and
# converted to a compressed qcow2. See README.md in this directory.
#
# usage: build-disk.sh [OUTDIR]   (default: the directory of this script)
# env:   WIN_VERSION=2025 WIN_USERNAME=e2b WIN_PASSWORD=... WIN_DISK_SIZE=32G
#        WIN_RAM_SIZE=6G WIN_CPU_CORES=4 DOCKUR_IMAGE=ghcr.io/dockur/windows
#        DOCKUR_WEB_PORT=8006 DOCKUR_RDP_PORT=3389 WIN_INSTALL_TIMEOUT=7200 WIN_SETTLE=180
set -euo pipefail
OUT=$(realpath "${1:-$(dirname "$0")}")
: "${WIN_PASSWORD:?set WIN_PASSWORD (the local admin password baked into the disk)}"
WIN_VERSION=${WIN_VERSION:-2025}
WIN_USERNAME=${WIN_USERNAME:-e2b}
WIN_DISK_SIZE=${WIN_DISK_SIZE:-32G}
WIN_RAM_SIZE=${WIN_RAM_SIZE:-6G}
WIN_CPU_CORES=${WIN_CPU_CORES:-4}
DOCKUR_IMAGE=${DOCKUR_IMAGE:-ghcr.io/dockur/windows}
DOCKUR_WEB_PORT=${DOCKUR_WEB_PORT:-8006}
DOCKUR_RDP_PORT=${DOCKUR_RDP_PORT:-3389}
WIN_INSTALL_TIMEOUT=${WIN_INSTALL_TIMEOUT:-7200}
WIN_SETTLE=${WIN_SETTLE:-180}
NAME=windows-nested-build
STORAGE=$OUT/dockur-storage
RDPCHECK=$(dirname "$0")/../win/rdpcheck.py

[ -c /dev/kvm ] || { echo "/dev/kvm missing: dockur needs a KVM host"; exit 1; }
mkdir -p "$STORAGE"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -e VERSION="$WIN_VERSION" -e DISK_SIZE="$WIN_DISK_SIZE" -e RAM_SIZE="$WIN_RAM_SIZE" -e CPU_CORES="$WIN_CPU_CORES" \
  -e USERNAME="$WIN_USERNAME" -e PASSWORD="$WIN_PASSWORD" -e LANGUAGE=English -e REGION=en-US -e KEYBOARD=en-US \
  -p 127.0.0.1:"$DOCKUR_WEB_PORT":8006 -p 127.0.0.1:"$DOCKUR_RDP_PORT":3389/tcp \
  -v "$STORAGE":/storage \
  --device=/dev/kvm --device=/dev/net/tun --cap-add NET_ADMIN --stop-timeout 180 \
  "$DOCKUR_IMAGE" >/dev/null
echo "installer running; watch it at http://127.0.0.1:$DOCKUR_WEB_PORT"

T0=$(date +%s)
until python3 "$RDPCHECK" 127.0.0.1 "$DOCKUR_RDP_PORT" >/dev/null 2>&1; do
  sleep 15
  if (( $(date +%s) - T0 > WIN_INSTALL_TIMEOUT )); then echo "timeout waiting for the installed Windows to answer RDP"; exit 1; fi
  docker ps -q -f name="$NAME" | grep -q . || { echo "installer container exited"; docker logs --tail 20 "$NAME"; exit 1; }
done
echo "Windows answers RDP after $(( $(date +%s) - T0 ))s; settling for ${WIN_SETTLE}s"
sleep "$WIN_SETTLE"

echo "shutting Windows down (ACPI)"
docker stop -t 180 "$NAME" >/dev/null
docker rm "$NAME" >/dev/null

echo "converting to compressed qcow2"
qemu-img convert -p -f raw -O qcow2 -c -o compression_type=zstd "$STORAGE/data.img" "$OUT/win.qcow2"
cp "$STORAGE/windows.rom" "$OUT/OVMF_CODE.fd"
qemu-img convert -f raw -O qcow2 "$STORAGE/windows.vars" "$OUT/OVMF_VARS.qcow2"
rm -rf "$STORAGE"
qemu-img info "$OUT/win.qcow2" | grep -E "virtual size|disk size"
ls -la "$OUT"/win.qcow2 "$OUT"/OVMF_CODE.fd "$OUT"/OVMF_VARS.qcow2
