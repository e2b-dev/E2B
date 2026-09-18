"""The execution timeout must reach the transport as the request deadline.

Regression test for the SDK's pyqwest-backed transport collapsing httpx's
per-phase timeouts into a single whole-request deadline, which it derives as
the sum of the `read` and `write` phases (`connect` and `pool` are ignored).
Setting both phases to `timeout` therefore gave a deadline of `2 * timeout`,
so an execution was aborted at twice the `timeout` it asked for.
"""

import socket
import threading
import time

import httpx
import pytest
from pyqwest.httpx._transport import convert_timeout

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
        self._captured["args"] = args
        self._captured.update(kwargs)
        raise _Stop


def _sandbox(cls, captured=None, connection_config=None, url="http://127.0.0.1:9"):
    class _Fake(cls):
        @property
        def connection_config(self):
            return connection_config or ConnectionConfig(
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
            return url

        @property
        def _client(self):
            if captured is None:
                return super()._client
            return _CapturingClient(captured)

    return _Fake.__new__(_Fake)


def _captured_timeout(captured: dict) -> httpx.Timeout:
    timeout = captured["timeout"]
    assert isinstance(timeout, httpx.Timeout), (
        f"expected an httpx.Timeout carrying the deadline; got {timeout!r}"
    )
    return timeout


def _derived_deadline(timeout: httpx.Timeout) -> float | None:
    """The single operation deadline the transport derives for a request."""
    return convert_timeout({"timeout": timeout.as_dict()})


class _StallingJupyterServer:
    """Plays a Jupyter server that sends the headers, then stalls.

    The body only follows `stall` seconds later, so the deadline the transport
    derives from the request timeout is the only thing that can end the request
    before then.
    """

    RESULT_LINE = b'{"type":"result","is_main_result":true,"text":"42"}\n'

    def __init__(self, stall: float):
        self._stall = stall
        self._socket = socket.socket()
        self._socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._socket.bind(("127.0.0.1", 0))
        self._socket.listen(1)
        self.url = f"http://127.0.0.1:{self._socket.getsockname()[1]}"

    def __enter__(self):
        threading.Thread(target=self._serve, daemon=True).start()
        return self

    def __exit__(self, *_):
        self._socket.close()

    def _serve(self):
        try:
            connection, _ = self._socket.accept()
        except OSError:
            return
        with connection:
            connection.recv(65536)
            connection.sendall(
                b"HTTP/1.1 200 OK\r\n"
                b"Content-Type: application/x-ndjson\r\n"
                b"Connection: close\r\n\r\n"
            )
            time.sleep(self._stall)
            try:
                connection.sendall(self.RESULT_LINE)
            except OSError:
                pass


@pytest.mark.parametrize("timeout", [3, 10, 300])
def test_execution_timeout_is_the_request_deadline(timeout):
    captured: dict = {}
    with pytest.raises(_Stop):
        _sandbox(Sandbox, captured).run_code("1 + 1", timeout=timeout)

    tmo = _captured_timeout(captured)
    # The transport derives its deadline by summing `read` and `write`, so the
    # whole budget sits on one phase and the other contributes nothing.
    assert tmo.read == timeout
    assert tmo.write == 0
    assert tmo.connect == REQUEST_TIMEOUT
    assert _derived_deadline(tmo) == timeout


@pytest.mark.parametrize("timeout", [3, 10, 300])
async def test_async_execution_timeout_is_the_request_deadline(timeout):
    captured: dict = {}
    with pytest.raises(_Stop):
        await _sandbox(AsyncSandbox, captured).run_code("1 + 1", timeout=timeout)

    tmo = _captured_timeout(captured)
    assert tmo.read == timeout
    assert tmo.write == 0
    assert tmo.connect == REQUEST_TIMEOUT
    assert _derived_deadline(tmo) == timeout


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


# Long enough that a deadline of twice the requested timeout also elapses
# before the server sends the body.
STALL = 4.0


def test_execution_is_aborted_after_timeout_seconds():
    with _StallingJupyterServer(STALL) as server:
        started = time.monotonic()
        with pytest.raises(TimeoutException, match="Execution timed out"):
            _sandbox(Sandbox, url=server.url).run_code("1 + 1", timeout=1)
        elapsed = time.monotonic() - started

    assert elapsed < 1.5, f"run_code(timeout=1) was aborted after {elapsed:.2f}s"


async def test_async_execution_is_aborted_after_timeout_seconds():
    with _StallingJupyterServer(STALL) as server:
        started = time.monotonic()
        with pytest.raises(TimeoutException, match="Execution timed out"):
            await _sandbox(AsyncSandbox, url=server.url).run_code("1 + 1", timeout=1)
        elapsed = time.monotonic() - started

    assert elapsed < 1.5, f"run_code(timeout=1) was aborted after {elapsed:.2f}s"


def test_execution_within_timeout_is_not_aborted():
    with _StallingJupyterServer(1.0) as server:
        execution = _sandbox(Sandbox, url=server.url).run_code("1 + 1", timeout=5)

    assert execution.text == "42"


def test_context_request_is_aborted_after_request_timeout_seconds():
    config = ConnectionConfig(api_key="x", domain="e2b.app", request_timeout=1)
    with _StallingJupyterServer(STALL) as server:
        started = time.monotonic()
        with pytest.raises(TimeoutException, match="Request timed out"):
            _sandbox(
                Sandbox, connection_config=config, url=server.url
            ).list_code_contexts()
        elapsed = time.monotonic() - started

    assert elapsed < 1.5, f"list_code_contexts() was aborted after {elapsed:.2f}s"


async def test_async_context_request_is_aborted_after_request_timeout_seconds():
    config = ConnectionConfig(api_key="x", domain="e2b.app", request_timeout=1)
    with _StallingJupyterServer(STALL) as server:
        started = time.monotonic()
        with pytest.raises(TimeoutException, match="Request timed out"):
            await _sandbox(
                AsyncSandbox, connection_config=config, url=server.url
            ).list_code_contexts()
        elapsed = time.monotonic() - started

    assert elapsed < 1.5, f"list_code_contexts() was aborted after {elapsed:.2f}s"


def test_execute_tags_ci_traffic_in_request_url(monkeypatch):
    monkeypatch.setenv("E2B_USER_AGENT_SOURCE", "ci")
    captured: dict = {}

    with pytest.raises(_Stop):
        _sandbox(Sandbox, captured).run_code("1 + 1")

    assert captured["args"][:2] == (
        "POST",
        "http://127.0.0.1:9/execute?source=ci",
    )


async def test_async_execute_tags_ci_traffic_in_request_url(monkeypatch):
    monkeypatch.setenv("E2B_USER_AGENT_SOURCE", "ci")
    captured: dict = {}

    with pytest.raises(_Stop):
        await _sandbox(AsyncSandbox, captured).run_code("1 + 1")

    assert captured["args"][:2] == (
        "POST",
        "http://127.0.0.1:9/execute?source=ci",
    )


class _LegacyConnectionConfig:
    request_timeout = REQUEST_TIMEOUT


def test_execute_supports_legacy_e2b_connection_config():
    captured: dict = {}

    with pytest.raises(_Stop):
        _sandbox(Sandbox, captured, _LegacyConnectionConfig()).run_code("1 + 1")

    assert captured["args"][:2] == ("POST", "http://127.0.0.1:9/execute")


async def test_async_execute_supports_legacy_e2b_connection_config():
    captured: dict = {}

    with pytest.raises(_Stop):
        await _sandbox(AsyncSandbox, captured, _LegacyConnectionConfig()).run_code(
            "1 + 1"
        )

    assert captured["args"][:2] == ("POST", "http://127.0.0.1:9/execute")
