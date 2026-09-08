#!/bin/bash
# Relaunch mode, build-time RUN step: boot Windows, wait for RDP, QEMU `savevm win`,
# quit. No nested VM may be alive when the sandbox snapshot is taken.
set -euo pipefail
WIN_DIR=${WIN_DIR:-/opt/win}
WIN_BOOT_TIMEOUT=${WIN_BOOT_TIMEOUT:-2700}
WIN_SETTLE=${WIN_SETTLE:-60}
cd "$WIN_DIR"; source ./qemu-common.sh
T0=$(date +%s)
log(){ echo "[$(date -u +%FT%TZ) +$(( $(date +%s) - T0 ))s] $*" | tee -a build.log; }

log "kvm=$(ls /dev/kvm 2>&1) vmx=$(grep -c vmx /proc/cpuinfo) nproc=$(nproc) mem_mb=$(free -m | awk '/Mem/{print $2}') free=$(df -h / | awk 'NR==2{print $4}')"
rm -f qmp.sock qemu.pid
qemu-system-x86_64 "${QEMU_ARGS[@]}" -daemonize
log "qemu started pid=$(cat qemu.pid)"
until python3 rdpcheck.py 127.0.0.1 "$WIN_RDP_PORT" >/dev/null 2>&1; do
  sleep 3
  if (( $(date +%s) - T0 > WIN_BOOT_TIMEOUT )); then
    log "TIMEOUT waiting for RDP"; python3 qmp.py screendump "$WIN_DIR/build-fail.ppm" || true; exit 1
  fi
done
log "RDP answers"
sleep "$WIN_SETTLE"
T1=$(date +%s)
python3 qmp.py hmp "savevm win"
log "savevm done in $(( $(date +%s) - T1 ))s"
python3 qmp.py quit || true
while kill -0 "$(cat qemu.pid 2>/dev/null)" 2>/dev/null; do sleep 1; done
log "qemu exited"
qemu-img snapshot -l win.qcow2 | tee -a build.log
df -h / | tee -a build.log
