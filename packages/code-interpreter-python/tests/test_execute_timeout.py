"""The execution timeout must reach the transport as the request deadline.

Regression test for the SDK's pyqwest-backed transport collapsing httpx's
per-phase timeouts into a single whole-request deadline equal to the longest
phase. With the previous `(request_timeout, timeout, request_timeout,
request_timeout)` tuple that deadline came out as `max(timeout,
request_timeout)`, so any `timeout` shorter than `request_timeout` was silently
ignored and an execution ran on until `request_timeout` instead.
"""

import httpx
import pytest

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
