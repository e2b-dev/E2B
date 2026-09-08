#!/usr/bin/env python3
"""Minimal QMP client. usage: qmp.py hmp "<monitor command>" | screendump <file.ppm> | quit | query-status"""

import json
import os
import socket
import sys

SOCK = os.environ.get(
    "QMP_SOCK", os.path.join(os.environ.get("WIN_DIR", "/opt/win"), "qmp.sock")
)


def cmd(execute, **args):
    return (
        json.dumps(
            {"execute": execute, **({"arguments": args} if args else {})}
        ).encode()
        + b"\n"
    )


s = socket.socket(socket.AF_UNIX)
s.settimeout(1800)
s.connect(SOCK)
f = s.makefile("rb")
f.readline()
s.sendall(cmd("qmp_capabilities"))
f.readline()
what = sys.argv[1]
if what == "hmp":
    s.sendall(cmd("human-monitor-command", **{"command-line": sys.argv[2]}))
elif what == "screendump":
    s.sendall(cmd("screendump", filename=sys.argv[2]))
else:
    s.sendall(cmd(what))
while True:
    line = f.readline()
    if not line:
        break
    msg = json.loads(line)
    if "return" in msg or "error" in msg:
        print(json.dumps(msg))
        sys.exit(1 if "error" in msg else 0)
