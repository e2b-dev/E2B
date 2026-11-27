"""httpx timeouts on the SDK's pyqwest-backed transports are exact deadlines.

pyqwest's httpx adapter turns httpx's per-phase timeouts into a single
whole-request deadline equal to ``read + write``. httpx fills both phases
with the same value, so without the SDK's rewrite every timeout took twice
as long as configured (``timeout=2`` raised after 4 s). The SDK transports
make the deadline ``max(read, write)`` instead.
"""

import contextlib
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Iterator

import httpx
import pytest
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from pyqwest.httpx._transport import convert_timeout

from transport_caches import reset_transport_caches

import e2b.api.client_async as api_client_async
import e2b.api.client_sync as api_client_sync
from e2b.api.transport_timeout import (
    AsyncDeadlinePyqwestTransport,
    DeadlinePyqwestTransport,
    normalize_timeout_extension,
)
from e2b.connection_config import ConnectionConfig
from e2b.envd import client_async as envd_client_async
from e2b.envd import client_sync as envd_client_sync
from e2b.envd.process.process_connect import ProcessClient, ProcessClientSync
from e2b.envd.process.process_pb import ListRequest

TIMEOUT = 1.0
SERVER_DELAY = 5.0
# The deadline must fire at TIMEOUT, well before the doubled 2 * TIMEOUT.
MIN_ELAPSED = TIMEOUT * 0.9
MAX_ELAPSED = TIMEOUT * 1.6


@pytest.mark.parametrize(
    "timeout, expected",
    [
        (httpx.Timeout(5), 5.0),
        (httpx.Timeout(20, connect=60), 20.0),
        (httpx.Timeout(5, read=3, write=8), 8.0),
        (httpx.Timeout(5, read=8, write=3), 8.0),
        (httpx.Timeout(None), None),
        (httpx.Timeout(5, write=None), None),
        (httpx.Timeout(5, read=None), None),
    ],
)
def test_deadline_is_the_longest_phase(timeout, expected):
    extensions = {"timeout": timeout.as_dict()}
    assert convert_timeout(normalize_timeout_extension(extensions)) == expected


def test_no_timeout_extension_means_no_deadline():
    assert convert_timeout(normalize_timeout_extension({})) is None


def test_extensions_are_not_mutated():
    timeout = httpx.Timeout(5).as_dict()
    extensions = {"timeout": timeout, "other": 1}
    normalized = normalize_timeout_extension(extensions)
    assert extensions == {"timeout": httpx.Timeout(5).as_dict(), "other": 1}
    assert normalized["other"] == 1


class _SlowHandler(BaseHTTPRequestHandler):
    """``/slow`` answers after ``SERVER_DELAY``; ``/stall`` sends the headers
    at once and then stalls the body for ``SERVER_DELAY``."""

    def do_GET(self):
        try:
            if self.path == "/stall":
                self.send_response(200)
                self.send_header("Content-Length", "2")
                self.end_headers()
                self.wfile.write(b"o")
                self.wfile.flush()
                time.sleep(SERVER_DELAY)
                self.wfile.write(b"k")
            else:
                time.sleep(SERVER_DELAY)
                self.send_response(200)
                self.send_header("Content-Length", "2")
                self.end_headers()
                self.wfile.write(b"ok")
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_POST(self):
        self.do_GET()

    def log_message(self, *args):
        pass


@contextlib.contextmanager
def slow_server() -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), _SlowHandler)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()


def assert_deadline(elapsed: float):
    assert MIN_ELAPSED <= elapsed < MAX_ELAPSED, (
        f"timed out after {elapsed:.2f}s, expected ~{TIMEOUT}s "
        f"(2x would be {2 * TIMEOUT}s)"
    )


def test_sync_timeout_is_exact():
    with (
        slow_server() as url,
        httpx.Client(
            transport=api_client_sync.get_httpx_transport(None), timeout=TIMEOUT
        ) as client,
    ):
        start = time.monotonic()
        with pytest.raises(httpx.ReadTimeout):
            client.get(f"{url}/slow")
        assert_deadline(time.monotonic() - start)


async def test_async_timeout_is_exact():
    with slow_server() as url:
        async with httpx.AsyncClient(
            transport=api_client_async.get_httpx_transport(None), timeout=TIMEOUT
        ) as client:
            start = time.monotonic()
            with pytest.raises(httpx.ReadTimeout):
                await client.get(f"{url}/slow")
            assert_deadline(time.monotonic() - start)


def test_sync_deadline_covers_the_streamed_body():
    with (
        slow_server() as url,
        httpx.Client(
            transport=api_client_sync.get_httpx_transport(None), timeout=TIMEOUT
        ) as client,
    ):
        start = time.monotonic()
        with client.stream("GET", f"{url}/stall") as response:
            assert response.status_code == 200
            with pytest.raises(httpx.ReadTimeout):
                for _ in response.iter_bytes():
                    pass
        assert_deadline(time.monotonic() - start)


async def test_async_deadline_covers_the_streamed_body():
    with slow_server() as url:
        async with httpx.AsyncClient(
            transport=api_client_async.get_httpx_transport(None), timeout=TIMEOUT
        ) as client:
            start = time.monotonic()
            async with client.stream("GET", f"{url}/stall") as response:
                assert response.status_code == 200
                with pytest.raises(httpx.ReadTimeout):
                    async for _ in response.aiter_bytes():
                        pass
            assert_deadline(time.monotonic() - start)


@pytest.mark.parametrize(
    "module, expected",
    [
        (api_client_sync, DeadlinePyqwestTransport),
        (api_client_async, AsyncDeadlinePyqwestTransport),
    ],
)
def test_shared_httpx_transports_use_the_exact_deadline(module, expected):
    reset_transport_caches()
    try:
        config = ConnectionConfig(api_key="e2b_" + "0" * 40)
        transports = [
            module.get_httpx_transport(None),
            module.get_httpx_transport(None, retry_connect=False),
            module.get_transport(config),
            module.get_transport(config, for_streaming=True),
            module.get_transport(config, http_version="1.1"),
        ]
        for transport in transports:
            assert isinstance(transport, expected)
        # Still one shared adapter per key.
        assert module.get_transport(config) is module.get_transport(config)
        assert module.get_httpx_transport(None) is module.get_httpx_transport(None)
    finally:
        reset_transport_caches()


# envd RPC never goes through the httpx adapters: connectrpc arms its own
# deadline from timeout_ms over the pyqwest-native client. These pin that it
# stays exact.


def test_sync_envd_rpc_deadline_is_exact():
    config = ConnectionConfig(api_key="e2b_" + "0" * 40)
    with slow_server() as url:
        client = envd_client_sync.create_rpc_client(ProcessClientSync, url, config)
        start = time.monotonic()
        with pytest.raises(ConnectError) as exc:
            client.list(ListRequest(), timeout_ms=int(TIMEOUT * 1000))
        assert_deadline(time.monotonic() - start)
    assert exc.value.code == Code.DEADLINE_EXCEEDED


async def test_async_envd_rpc_deadline_is_exact():
    config = ConnectionConfig(api_key="e2b_" + "0" * 40)
    with slow_server() as url:
        client = envd_client_async.create_rpc_client(ProcessClient, url, config)
        start = time.monotonic()
        with pytest.raises(ConnectError) as exc:
            await client.list(ListRequest(), timeout_ms=int(TIMEOUT * 1000))
        assert_deadline(time.monotonic() - start)
    assert exc.value.code == Code.DEADLINE_EXCEEDED
