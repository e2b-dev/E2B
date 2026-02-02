#!/usr/bin/env bash
set -euo pipefail

CLI_PATH="${CLI_PATH:-/Users/mattbrockman/Code/E2B/packages/cli/dist/index.js}"
E2B_DOMAIN="${E2B_DOMAIN:-}"
E2B_API_KEY="${E2B_API_KEY:-}"
TEMPLATE_ID="${E2B_TEMPLATE_ID:-${1:-base}}"
STRICT="${STRICT:-0}"

if [[ -z "$E2B_DOMAIN" || -z "$E2B_API_KEY" ]]; then
  echo "Missing E2B_DOMAIN or E2B_API_KEY." >&2
  echo "Example: E2B_DOMAIN=... E2B_API_KEY=... $0 <template-id-or-alias>" >&2
  exit 1
fi

if [[ ! -f "$CLI_PATH" ]]; then
  echo "CLI not found at $CLI_PATH. Build it with:" >&2
  echo "  pnpm -C /Users/mattbrockman/Code/E2B --filter @e2b/cli build" >&2
  exit 1
fi

python3 - "$TEMPLATE_ID" <<'PY'
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

template_id = sys.argv[1]
domain = os.environ["E2B_DOMAIN"]
api_key = os.environ["E2B_API_KEY"]
cli_path = os.environ.get("CLI_PATH", "/Users/mattbrockman/Code/E2B/packages/cli/dist/index.js")

api_base = f"https://api.{domain}"
payload = json.dumps({
    "templateID": template_id,
    "autoPause": False,
    "timeout": 600,
}).encode("utf-8")

req = urllib.request.Request(
    f"{api_base}/sandboxes",
    data=payload,
    headers={
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read()
except urllib.error.HTTPError as e:
    err_body = e.read()
    print(f"ERROR: sandbox create failed ({e.code}): {err_body[:200]!r}", file=sys.stderr)
    sys.exit(1)

data = json.loads(body)
sandbox_id = data.get("sandboxID") or data.get("id")
if not sandbox_id:
    print("ERROR: sandbox ID not found in response", file=sys.stderr)
    sys.exit(1)

print(f"Sandbox: {sandbox_id} (template: {template_id})")

tests = []

def add_test(name, data, read_bytes, expr, expected=None, expect_timeout=False, timeout_s=30):
    tests.append({
        "name": name,
        "data": data,
        "read_bytes": read_bytes,
        "expr": expr,
        "expected": expected,
        "expect_timeout": expect_timeout,
        "timeout_s": timeout_s,
    })

# Empty input: expected to block because CLI can't signal EOF
add_test("empty_blocks", b"", 1, "len(data)", expected="0", expect_timeout=True, timeout_s=10)

# ASCII with and without newline
add_test("ascii_newline", b"hello\n", 6, "len(data)", expected="6")
add_test("ascii_no_newline", b"hello", 5, "len(data)", expected="5")

# UTF-8 multibyte (snowman) without non-ASCII source chars
utf8_data = b"hi-" + bytes([0xE2, 0x98, 0x83])
add_test("utf8_multibyte", utf8_data, len(utf8_data), "len(data)", expected=str(len(utf8_data)))

# Chunk boundary tests
add_test("chunk_64k", b"a" * 65536, 65536, "len(data)", expected="65536")
add_test("chunk_64k_plus_1", b"a" * 65537, 65537, "len(data)", expected="65537")

# Binary with NUL and 0xFF (likely to expose UTF-8 corruption)
binary = bytes([0x00, 0x01, 0x02, 0xFF, 0x00, 0x41])
add_test("binary_nul_ff_hex", binary, len(binary), "data.hex()", expected=binary.hex())

# Random binary (checksum)
rand = os.urandom(1024)
add_test(
    "binary_random_sha256",
    rand,
    len(rand),
    "hashlib.sha256(data).hexdigest()",
    expected=hashlib.sha256(rand).hexdigest(),
)

pass_count = 0
fail_count = 0

for test in tests:
    name = test["name"]
    print(f"== {name}")
    cmd = [
        "node",
        cli_path,
        "sandbox",
        "exec",
        sandbox_id,
        "--",
        "python3",
        "-c",
        f"import sys,hashlib; data=sys.stdin.buffer.read({test['read_bytes']}); print({test['expr']})",
    ]

    env = os.environ.copy()
    env["E2B_DOMAIN"] = domain
    env["E2B_API_KEY"] = api_key
    env.pop("E2B_DEBUG", None)

    try:
        proc = subprocess.run(
            cmd,
            input=test["data"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=test["timeout_s"],
        )
    except subprocess.TimeoutExpired:
        if test["expect_timeout"]:
            print("PASS (timeout as expected)")
            pass_count += 1
        else:
            print("FAIL (timeout)")
            fail_count += 1
        continue

    stdout = proc.stdout.decode("utf-8", errors="replace").strip()
    stderr = proc.stderr.decode("utf-8", errors="replace").strip()

    if test["expect_timeout"]:
        print(f"FAIL expected timeout, got rc={proc.returncode} stdout={stdout!r} stderr={stderr!r}")
        fail_count += 1
        continue

    if proc.returncode != 0:
        print(f"FAIL rc={proc.returncode} stderr={stderr!r}")
        fail_count += 1
        continue

    expected = test["expected"]
    if expected is not None and stdout != expected:
        print(f"FAIL expected={expected!r} got={stdout!r}")
        fail_count += 1
        continue

    print("PASS")
    pass_count += 1

print(f"Summary: passed={pass_count} failed={fail_count}")
strict = os.environ.get("STRICT", "0") == "1"
if strict and fail_count > 0:
    sys.exit(1)
PY
