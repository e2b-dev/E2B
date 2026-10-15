"""Minimal deterministic ACP-shaped agent driven by test methods.

Kept in sync with packages/acp-js/tests/fakeAgent.ts.
"""

FAKE_AGENT = r"""
import json, os, sys, time

def send(message):
    sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
    sys.stdout.flush()

pending = {}
errors = []
for line in sys.stdin:
    message = json.loads(line)
    method, id, params = message.get("method"), message.get("id"), message.get("params")
    if method is None and message.get("id") is None:
        # Error response without an id, such as a parse error.
        errors.append(message.get("error"))
        continue
    if method is None:
        # Response to one of our requests.
        origin = pending.pop(message["id"], None)
        if origin is not None:
            send({"jsonrpc": "2.0", "id": origin, "result": message})
        continue
    if method == "initialize":
        send({"jsonrpc": "2.0", "id": id, "result": {"protocolVersion": 1, "received": params}})
    elif method == "test/echo":
        send({"jsonrpc": "2.0", "id": id, "result": params})
    elif method == "test/client_call":
        # Ask the client to run something on its machine.
        pending["call-" + str(id)] = id
        send({"jsonrpc": "2.0", "id": "call-" + str(id), "method": params["method"], "params": {}})
    elif method == "test/notify_client":
        send({"jsonrpc": "2.0", "method": "terminal/output", "params": {}})
        send({"jsonrpc": "2.0", "id": id, "result": "sent"})
    elif method == "test/bytewise":
        data = (json.dumps({"jsonrpc": "2.0", "id": id, "result": params["text"]}, ensure_ascii=False) + "\n").encode()
        for b in data:
            os.write(1, bytes([b]))
            time.sleep(0.002)
    elif method == "test/garbage":
        sys.stdout.write("not json\n")
        sys.stdout.flush()
        send({"jsonrpc": "2.0", "id": id, "result": "garbage sent"})
    elif method == "test/errors":
        send({"jsonrpc": "2.0", "id": id, "result": errors})
    elif method == "test/big":
        send({"jsonrpc": "2.0", "id": id, "result": "x" * params["size"]})
    elif method == "test/stderr_then_sleep":
        sys.stderr.write("log line\n")
        sys.stderr.flush()
        send({"jsonrpc": "2.0", "id": id, "result": "sleeping"})
        time.sleep(600)
    elif method == "test/exit":
        sys.stderr.write(params.get("stderr", ""))
        sys.stderr.flush()
        sys.exit(params["code"])
    elif method == "test/flood":
        for i in range(params["count"]):
            send({"jsonrpc": "2.0", "method": "session/update", "params": {"i": i}})
        send({"jsonrpc": "2.0", "id": id, "result": "flooded"})
    elif method == "test/ignore_eof":
        os.close(0)
        send({"jsonrpc": "2.0", "id": id, "result": "ignoring"})
        time.sleep(600)
"""

FAKE_AGENT_PATH = "/tmp/fake_acp_agent.py"
FAKE_AGENT_CMD = f"python3 -u {FAKE_AGENT_PATH}"
