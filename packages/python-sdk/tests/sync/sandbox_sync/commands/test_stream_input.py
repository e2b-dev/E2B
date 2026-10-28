import base64
import json
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Tuple, cast

import pytest
from packaging.version import Version

from e2b import InvalidArgumentException, NotFoundException, Sandbox, TimeoutException
from e2b.connection_config import ConnectionConfig


def test_stream_input_to_command(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)

    def input_lines():
        yield "first\n"
        time.sleep(1)
        yield "second\n"
        time.sleep(1)
        yield b"third\n"

    sandbox.commands.stream_input(cmd.pid, input_lines(), timeout=0)

    sandbox.commands.close_stdin(cmd.pid)
    result = cmd.wait()
    assert result.stdout.splitlines() == ["first", "second", "third"]


def test_stream_input_reports_missing_command(sandbox: Sandbox):
    with pytest.raises(NotFoundException):
        sandbox.commands.stream_input(999999, ["data"])


def test_stream_input_rejects_single_chunk(sandbox: Sandbox):
    with pytest.raises(InvalidArgumentException, match=r"\[data\]"):
        sandbox.commands.stream_input(1, cast(Any, b"ls\n"))


def test_stream_input_timeout(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)

    def slow_input():
        yield "first\n"
        time.sleep(2)
        yield "second\n"

    with pytest.raises(TimeoutException):
        sandbox.commands.stream_input(cmd.pid, slow_input(), timeout=1)

    sandbox.commands.close_stdin(cmd.pid)
    cmd.wait()


class _FakeEnvdHandler(BaseHTTPRequestHandler):
    """Answers envd's `process.Process/StreamInput` and records each request."""

    protocol_version = "HTTP/1.1"
    requests: List[Tuple[str, Dict[str, str], List[dict]]] = []

    def log_message(self, *args):  # noqa: A003 - silence the default stderr log
        pass

    def _read_chunked(self) -> bytes:
        body = b""
        while True:
            size = int(self.rfile.readline().strip(), 16)
            if size == 0:
                self.rfile.readline()
                return body
            body += self.rfile.read(size)
            self.rfile.readline()

    def do_POST(self):
        if self.headers.get("Transfer-Encoding") == "chunked":
            body = self._read_chunked()
        else:
            body = self.rfile.read(int(self.headers.get("Content-Length") or 0))

        messages = []
        while body:
            _, length = struct.unpack(">BI", body[:5])
            messages.append(json.loads(body[5 : 5 + length]))
            body = body[5 + length :]
        type(self).requests.append(
            (
                self.path,
                {k.lower(): v for k, v in self.headers.items()},
                messages,
            )
        )

        # A Connect client-streaming reply: one empty response message, then
        # the end-of-stream envelope.
        payload = struct.pack(">BI", 0, 2) + b"{}" + struct.pack(">BI", 2, 2) + b"{}"
        self.send_response(200)
        self.send_header("Content-Type", "application/connect+json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


@pytest.fixture
def fake_envd_sandbox(test_api_key):
    _FakeEnvdHandler.requests = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), _FakeEnvdHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield Sandbox(
            sandbox_id="sbx-test",
            sandbox_domain="sandbox.e2b.dev",
            envd_version=Version("0.5.0"),
            envd_access_token="tok",
            traffic_access_token="tok",
            connection_config=ConnectionConfig(
                api_key=test_api_key,
                sandbox_url=f"http://127.0.0.1:{server.server_port}",
            ),
        )
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def test_stream_input_sends_start_then_ordered_utf8_data(fake_envd_sandbox: Sandbox):
    fake_envd_sandbox.commands.stream_input(42, ["first", "café", b"second"], timeout=0)

    [(path, headers, messages)] = _FakeEnvdHandler.requests
    assert path == "/process.Process/StreamInput"
    # `timeout=0` disables the stream deadline.
    assert "connect-timeout-ms" not in headers
    assert messages[0] == {"start": {"process": {"pid": 42}}}
    data = [
        base64.b64decode(message["data"]["input"]["stdin"]) for message in messages[1:]
    ]
    assert data == [b"first", b"caf\xc3\xa9", b"second"]
