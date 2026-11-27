"""The execution timeout is the request deadline, and it is exact.

`run_code` hands `timeout` to the transport for every non-connect phase, so
the deadline is `timeout` and not `max(timeout, request_timeout)`. The SDK's
pyqwest-backed transport turns those phases into one whole-request deadline
of `max(read, write)` (see `e2b/api/transport_timeout.py`); plain pyqwest
would add them up and let an execution run for twice its `timeout`. The
wall-clock tests below run the real transport against a slow local server.
"""

import contextlib
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Iterator

import httpx
import pytest

from e2b import TimeoutException

from e2b.connection_config import ConnectionConfig

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
from e2b_code_interpreter.code_interpreter_sync import Sandbox

REQUEST_TIMEOUT = 60.0


class _Stop(Exception):
    """Unwinds `run_code` once the request timeout has been captured.

    Not an `httpx` error, so `run_code`'s own except clauses let it through.
    """


class _CapturingClient:
    def __init__(self, captured: dict):
        self._captured = captured

    def stream(self, *args, **kwargs):
        self._captured.update(kwargs)
        raise _Stop


def _sandbox(cls, captured: dict):
    class _Fake(cls):
        @property
        def connection_config(self):
            return ConnectionConfig(
                api_key="x", domain="e2b.app", request_timeout=REQUEST_TIMEOUT
            )

        @property
        def sandbox_id(self):
            return "sandbox-id"

        @property
        def _envd_access_token(self):
            return None

        @property
        def traffic_access_token(self):
            return None

        @property
        def _jupyter_url(self):
            return "http://127.0.0.1:9"

        @property
        def _client(self):
            return _CapturingClient(captured)

    return _Fake.__new__(_Fake)


def _captured_timeout(captured: dict) -> httpx.Timeout:
    timeout = captured["timeout"]
    assert isinstance(timeout, httpx.Timeout), (
        "a plain tuple lets the transport pick the longest phase as the deadline; "
        f"got {timeout!r}"
    )
    return timeout


@pytest.mark.parametrize("timeout", [3, 10, 300])
def test_execution_timeout_is_the_request_deadline(timeout):
    captured: dict = {}
    with pytest.raises(_Stop):
        _sandbox(Sandbox, captured).run_code("1 + 1", timeout=timeout)

    tmo = _captured_timeout(captured)
    # Every non-connect phase carries `timeout`, so the deadline the transport
    # derives is `timeout` and not `max(timeout, request_timeout)`.
    assert tmo.read == timeout
    assert tmo.write == timeout
    assert tmo.pool == timeout
    assert tmo.connect == REQUEST_TIMEOUT


@pytest.mark.parametrize("timeout", [3, 10, 300])
async def test_async_execution_timeout_is_the_request_deadline(timeout):
    captured: dict = {}
    with pytest.raises(_Stop):
        await _sandbox(AsyncSandbox, captured).run_code("1 + 1", timeout=timeout)

    tmo = _captured_timeout(captured)
    assert tmo.read == timeout
    assert tmo.write == timeout
    assert tmo.pool == timeout
    assert tmo.connect == REQUEST_TIMEOUT


def test_zero_timeout_disables_the_deadline():
    captured: dict = {}
    with pytest.raises(_Stop):
        _sandbox(Sandbox, captured).run_code("1 + 1", timeout=0)

    tmo = _captured_timeout(captured)
    # `connect` has to go too: with the other phases unset the transport falls
    # back to it, which would cap a deliberately unbounded execution.
    assert (tmo.read, tmo.write, tmo.pool, tmo.connect) == (None, None, None, None)


async def test_async_zero_timeout_disables_the_deadline():
    captured: dict = {}
    with pytest.raises(_Stop):
        await _sandbox(AsyncSandbox, captured).run_code("1 + 1", timeout=0)

    tmo = _captured_timeout(captured)
    assert (tmo.read, tmo.write, tmo.pool, tmo.connect) == (None, None, None, None)


TIMEOUT = 1
SERVER_DELAY = 5.0


class _SlowExecuteHandler(BaseHTTPRequestHandler):
    """`/slow/execute` answers after `SERVER_DELAY`; `/stall/execute` sends
    the headers and a first output line at once, then stalls the stream."""

    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        try:
            if self.path.startswith("/stall"):
                self.send_response(200)
                self.send_header("Content-Type", "application/x-ndjson")
                self.end_headers()
                self.wfile.write(b'{"type": "stdout", "text": "started"}\n')
                self.wfile.flush()
                time.sleep(SERVER_DELAY)
            else:
                time.sleep(SERVER_DELAY)
                self.send_response(200)
                self.end_headers()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *args):
        pass


@contextlib.contextmanager
def _slow_server() -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), _SlowExecuteHandler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()


def _slow_sandbox(cls, jupyter_url: str):
    """A sandbox whose `run_code` goes through the real `_client` (the SDK's
    shared transport) to `jupyter_url`."""

    class _Slow(cls):
        @property
        def connection_config(self):
            return ConnectionConfig(
                api_key="x", domain="e2b.app", request_timeout=REQUEST_TIMEOUT
            )

        @property
        def sandbox_id(self):
            return "sandbox-id"

        @property
        def _envd_access_token(self):
            return None

        @property
        def traffic_access_token(self):
            return None

        @property
        def _jupyter_url(self):
            return jupyter_url

    return _Slow.__new__(_Slow)


def _assert_exact(elapsed: float):
    assert 0.9 * TIMEOUT <= elapsed < 1.6 * TIMEOUT, (
        f"run_code(timeout={TIMEOUT}) raised after {elapsed:.2f}s"
    )


@pytest.mark.parametrize("path", ["slow", "stall"])
def test_execution_times_out_at_timeout(path):
    with _slow_server() as url:
        sandbox = _slow_sandbox(Sandbox, f"{url}/{path}")
        start = time.monotonic()
        with pytest.raises(TimeoutException, match="Execution timed out"):
            sandbox.run_code("import time; time.sleep(30)", timeout=TIMEOUT)
        _assert_exact(time.monotonic() - start)


@pytest.mark.parametrize("path", ["slow", "stall"])
async def test_async_execution_times_out_at_timeout(path):
    with _slow_server() as url:
        sandbox = _slow_sandbox(AsyncSandbox, f"{url}/{path}")
        start = time.monotonic()
        with pytest.raises(TimeoutException, match="Execution timed out"):
            await sandbox.run_code("import time; time.sleep(30)", timeout=TIMEOUT)
        _assert_exact(time.monotonic() - start)
