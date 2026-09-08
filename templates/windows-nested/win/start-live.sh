#!/bin/bash
# Live mode start command: cold-boot Windows and leave QEMU running, so the
# template snapshot holds a live nested VM. The ready command (rdpcheck.py) gates
# the snapshot. Needs a Firecracker that restores KVM nested state and a guest
# kernel booted with no-kvmapf; with stock Firecracker the resumed sandbox panics.
set -uo pipefail
WIN_DIR=${WIN_DIR:-/opt/win}
cd "$WIN_DIR"; source ./qemu-common.sh
log(){ echo "[$(date -u +%FT%TZ) mono=$(cut -d' ' -f1 /proc/uptime)] $*" >> live.log; }

rm -f qmp.sock qemu.pid
qemu-system-x86_64 "${QEMU_ARGS[@]}" -daemonize
log "qemu started pid=$(cat qemu.pid)"
setsid websockify --web /usr/share/novnc 0.0.0.0:6080 127.0.0.1:5900 </dev/null >websockify.out 2>&1 &
while true; do
  st=$(python3 rdpcheck.py 127.0.0.1 "$WIN_RDP_PORT" 2>&1)
  q=$(kill -0 "$(cat qemu.pid 2>/dev/null)" 2>/dev/null && echo qemu-alive || echo qemu-dead)
  echo "$(date -u +%s) $(cut -d' ' -f1 /proc/uptime) $q $st" >> heartbeat
  sleep 5
done
