"""The execution timeout must reach the transport as the request deadline.

The SDK's pyqwest-backed transport collapses httpx's per-phase timeouts into a
single whole-request deadline by summing the read and write phases (see
`convert_timeout` in `pyqwest.httpx._transport`). Building the timeout as
`httpx.Timeout(timeout, connect=request_timeout)` sets read = write = timeout,
so the derived deadline was `2 * timeout` and `run_code(timeout=1)` aborted
after two seconds. The timeout must be built so that read + write equals the
requested budget, which these tests assert through the transport's own
derivation.
"""

import httpx
import pytest
from pyqwest.httpx._transport import convert_timeout

from e2b.connection_config import ConnectionConfig

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
from e2b_code_interpreter.code_interpreter_sync import Sandbox, _request_deadline

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
        f"a plain tuple lets the transport pick its own deadline; got {timeout!r}"
    )
    return timeout


def _assert_deadline(tmo: httpx.Timeout, timeout, request_timeout) -> None:
    # The write phase is 0 so the transport's read + write sum equals the
    # requested budget; `connect` alone carries `request_timeout`.
    assert tmo.read == timeout
    assert tmo.write == 0
    assert tmo.pool == timeout
    assert tmo.connect == request_timeout
    # The deadline the pyqwest transport actually derives.
    assert convert_timeout({"timeout": tmo.as_dict()}) == timeout


@pytest.mark.parametrize("timeout", [3, 10, 300])
def test_execution_timeout_is_the_request_deadline(timeout):
    captured: dict = {}
    with pytest.raises(_Stop):
        _sandbox(Sandbox, captured).run_code("1 + 1", timeout=timeout)

    _assert_deadline(_captured_timeout(captured), timeout, REQUEST_TIMEOUT)


@pytest.mark.parametrize("timeout", [3, 10, 300])
async def test_async_execution_timeout_is_the_request_deadline(timeout):
    captured: dict = {}
    with pytest.raises(_Stop):
        await _sandbox(AsyncSandbox, captured).run_code("1 + 1", timeout=timeout)

    _assert_deadline(_captured_timeout(captured), timeout, REQUEST_TIMEOUT)


@pytest.mark.parametrize("timeout", [3, 10, 300])
def test_scalar_request_timeout_is_the_request_deadline(timeout):
    """The context requests pass their budget without a separate connect
    value; the transport must derive a single `timeout` deadline, not twice
    it."""
    _assert_deadline(_request_deadline(timeout), timeout, timeout)


def test_zero_timeout_disables_the_deadline():
    captured: dict = {}
    with pytest.raises(_Stop):
        _sandbox(Sandbox, captured).run_code("1 + 1", timeout=0)

    tmo = _captured_timeout(captured)
    # `connect` has to go too: with the other phases unset the transport falls
    # back to it, which would cap a deliberately unbounded execution.
    assert (tmo.read, tmo.write, tmo.pool, tmo.connect) == (None, None, None, None)
    assert convert_timeout({"timeout": tmo.as_dict()}) is None


async def test_async_zero_timeout_disables_the_deadline():
    captured: dict = {}
    with pytest.raises(_Stop):
        await _sandbox(AsyncSandbox, captured).run_code("1 + 1", timeout=0)

    tmo = _captured_timeout(captured)
    assert (tmo.read, tmo.write, tmo.pool, tmo.connect) == (None, None, None, None)
    assert convert_timeout({"timeout": tmo.as_dict()}) is None
