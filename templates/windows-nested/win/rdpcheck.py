#!/usr/bin/env python3
"""RDP liveness: an X.224 Connection Request answered by a Connection Confirm.
A bare TCP connect is not enough: QEMU's user-mode hostfwd accepts before the
guest port is open. usage: rdpcheck.py [host] [port]"""

import socket
import sys

host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
port = int(sys.argv[2]) if len(sys.argv) > 2 else 3389
cookie = b"Cookie: mstshash=e2b\r\n"
neg = bytes.fromhex("0100080003000000")  # RDP_NEG_REQ: PROTOCOL_SSL|HYBRID
x224 = bytes([6 + len(cookie) + len(neg), 0xE0, 0, 0, 0, 0, 0]) + cookie + neg
tpkt = bytes([3, 0]) + (4 + len(x224)).to_bytes(2, "big") + x224
try:
    s = socket.create_connection((host, port), timeout=3)
    s.settimeout(5)
    s.sendall(tpkt)
    r = s.recv(64)
    s.close()
    ok = len(r) >= 7 and r[0] == 0x03 and r[5] == 0xD0
    print("rdp", "up" if ok else f"odd-reply {r.hex()}")
    sys.exit(0 if ok else 1)
except OSError as e:
    print("rdp down", e)
    sys.exit(1)
