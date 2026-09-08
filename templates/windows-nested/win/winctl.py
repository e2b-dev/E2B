#!/usr/bin/env python3
"""Relaunch mode start command: idle at build time; on sandbox create it launches
Windows from the QEMU snapshot (-loadvm win) plus noVNC and records timings.

Resume signal: envd sets CLOCK_REALTIME to host time on every start while
CLOCK_MONOTONIC continues from the snapshot, so (realtime - monotonic) jumps by
the time the template spent frozen. `touch $WIN_DIR/start-now` is the fallback."""

import json
import os
import subprocess
import time

D = os.environ.get("WIN_DIR", "/opt/win")
LOG, STATE, TRIGGER = f"{D}/winctl.log", f"{D}/state.json", f"{D}/start-now"
RDP_PORT = os.environ.get("WIN_RDP_PORT", "3389")
JUMP_S = 3.0
RDP_TIMEOUT_S = 1800
state = {"events": []}


def log(msg, **kv):
    w, m = time.time(), time.monotonic()
    state["events"].append({"event": msg, "wall": w, "mono": m, **kv})
    with open(LOG, "a") as f:
        f.write(
            f"{time.strftime('%FT%TZ', time.gmtime(w))} mono={m:.3f} {msg} {kv or ''}\n"
        )
    with open(STATE + ".tmp", "w") as f:
        json.dump(state, f)
    os.replace(STATE + ".tmp", STATE)


def qemu_args():
    out = subprocess.run(
        [
            "bash",
            "-c",
            f'source "{D}/qemu-common.sh"; printf "%s\\n" "${{QEMU_ARGS[@]}}"',
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return out.rstrip("\n").split("\n")


def rdp_up():
    return (
        subprocess.run(
            ["python3", f"{D}/rdpcheck.py", "127.0.0.1", RDP_PORT], capture_output=True
        ).returncode
        == 0
    )


def launch(reason):
    for p in ("qmp.sock", "qemu.pid"):
        try:
            os.remove(f"{D}/{p}")
        except FileNotFoundError:
            pass
    q = subprocess.Popen(
        ["qemu-system-x86_64", *qemu_args(), "-loadvm", "win"],
        stdout=open(f"{D}/qemu.out", "a"),
        stderr=subprocess.STDOUT,
    )
    log("qemu_started", reason=reason, pid=q.pid)
    subprocess.Popen(
        ["websockify", "--web", "/usr/share/novnc", "0.0.0.0:6080", "127.0.0.1:5900"],
        stdout=open(f"{D}/websockify.out", "a"),
        stderr=subprocess.STDOUT,
    )
    log("websockify_started")
    t0 = time.monotonic()
    while time.monotonic() - t0 < RDP_TIMEOUT_S:
        if q.poll() is not None:
            log("qemu_exited", rc=q.returncode)
            return
        if rdp_up():
            log("rdp_up", after_s=round(time.monotonic() - t0, 2))
            return
        time.sleep(0.5)
    log("rdp_timeout")


open(LOG, "a").close()
log("watcher_started", pid=os.getpid(), kvm=os.path.exists("/dev/kvm"))
base = time.time() - time.monotonic()
open(f"{D}/winctl.ready", "w").close()
launched = False
while True:
    off = time.time() - time.monotonic()
    jump = off - base
    trig = os.path.exists(TRIGGER)
    if abs(jump) > JUMP_S or trig:
        reason = "trigger-file" if trig else f"clock-jump {jump:.1f}s"
        if trig:
            os.remove(TRIGGER)
        log("resume_detected", reason=reason, jump_s=round(jump, 3))
        base = off
        if launched:
            log("already_launched_ignoring")
        else:
            launched = True
            launch(reason)
    time.sleep(0.2)
