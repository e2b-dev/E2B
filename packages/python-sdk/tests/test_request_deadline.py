"""The SDK's timeouts are whole-request deadlines, but ``httpx.Timeout`` only
has per-phase fields and pyqwest's httpx adapter approximates a deadline as
``read + write``, so ``httpx.Timeout(60)`` would be enforced at 120 s (#1881:
``run_code(timeout=N)`` ran for ~2N). ``e2b.deadline`` resolves that in one
place: the ``read`` phase *is* the deadline, the shared transports rewrite the
phases so pyqwest enforces exactly that, and the retry layer budgets against
the same number.
"""

import asyncio
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest
from transport_caches import reset_transport_caches

from e2b.api.client_async import get_api_client as get_async_api_client
from e2b.api.client_async import get_envd_api as get_async_envd_api
from e2b.api.client_sync import get_api_client, get_envd_api
from e2b.connection_config import ConnectionConfig
from e2b.deadline import request_deadline, with_request_deadline
from e2b.retry import MAX_RETRY_WAIT_WITHOUT_TIMEOUT_SECONDS, _request_deadline

# Long enough that a request bounded by pyqwest's doubled deadline would still
# be waiting when the assertions below run.
STALL_SECONDS = 3.0
DEADLINE = 0.5
# Old behaviour was >= 2 * DEADLINE; the slack absorbs CI scheduling noise.
MAX_ELAPSED = DEADLINE + 0.4


def _extensions(timeout):
    return {} if timeout is None else {"timeout": timeout.as_dict()}


@pytest.mark.parametrize(
    "timeout, deadline",
    [
        (httpx.Timeout(60), 60),
        (httpx.Timeout(5, connect=60), 5),
        (httpx.Timeout(None), None),
        (httpx.Timeout(60, read=None), None),
        (None, None),
    ],
)
def test_request_deadline_is_the_read_phase(timeout, deadline):
    assert request_deadline(_extensions(timeout)) == deadline


@pytest.mark.parametrize(
    "timeout",
    [httpx.Timeout(60), httpx.Timeout(5, connect=60), httpx.Timeout(5, write=0.1)],
)
def test_with_request_deadline_makes_pyqwest_phase_sum_the_deadline(timeout):
    phases = with_request_deadline(_extensions(timeout))["timeout"]
    assert phases["read"] + phases["write"] == request_deadline(_extensions(timeout))
    assert phases["connect"] == timeout.connect
    assert phases["pool"] == timeout.pool


@pytest.mark.parametrize("timeout", [httpx.Timeout(None), httpx.Timeout(60, read=None)])
def test_with_request_deadline_keeps_unbounded_requests_unbounded(timeout):
    phases = with_request_deadline(_extensions(timeout))["timeout"]
    assert phases["read"] is None
    assert phases["write"] is None


def test_with_request_deadline_leaves_other_extensions_alone():
    assert with_request_deadline({}) == {}
    extensions = {"trace": "x", "timeout": httpx.Timeout(1).as_dict()}
    assert with_request_deadline(extensions)["trace"] == "x"
    assert extensions["timeout"]["write"] == 1


def test_retry_budget_is_the_request_deadline():
    def request(timeout):
        return httpx.Request("GET", "http://example", extensions=_extensions(timeout))

    # Not min(phases): a long execution with a short connect bound keeps its
    # full budget for retries.
    assert (
        _request_deadline(request(httpx.Timeout(300, connect=60)), lambda: 0.0) == 300
    )
    assert (
        _request_deadline(request(httpx.Timeout(None)), lambda: 0.0)
        == MAX_RETRY_WAIT_WITHOUT_TIMEOUT_SECONDS
    )
    assert (
        _request_deadline(request(None), lambda: 0.0)
        == MAX_RETRY_WAIT_WITHOUT_TIMEOUT_SECONDS
    )


class _StallHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _stall(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.flush()
        time.sleep(STALL_SECONDS)
        try:
            self.wfile.write(b"{}")
        except OSError:
            pass

    do_GET = _stall
    do_POST = _stall

    def log_message(self, *args):
        pass


@pytest.fixture
def stall_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _StallHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        thread.join()


def _assert_deadline(elapsed: float):
    assert DEADLINE <= elapsed < MAX_ELAPSED, elapsed


def test_sync_api_client_request_timeout_is_a_deadline(test_api_key, stall_server):
    reset_transport_caches()
    config = ConnectionConfig(
        api_key=test_api_key, api_url=stall_server, request_timeout=DEADLINE
    )
    with get_api_client(config) as client:
        started = time.monotonic()
        with pytest.raises(httpx.TimeoutException):
            client.get_httpx_client().get("/stall")
        _assert_deadline(time.monotonic() - started)


def test_sync_envd_per_request_timeout_is_a_deadline(test_api_key, stall_server):
    reset_transport_caches()
    client = get_envd_api(ConnectionConfig(api_key=test_api_key), stall_server)
    started = time.monotonic()
    with pytest.raises(httpx.TimeoutException):
        # How code-interpreter's run_code passes `timeout`: a separate connect
        # bound must not stretch the deadline.
        client.post("/stall", timeout=httpx.Timeout(DEADLINE, connect=60))
    _assert_deadline(time.monotonic() - started)


def test_sync_disabled_timeout_waits_for_the_response(test_api_key, stall_server):
    reset_transport_caches()
    client = get_envd_api(ConnectionConfig(api_key=test_api_key), stall_server)
    response = client.get("/stall", timeout=httpx.Timeout(None))
    assert response.json() == {}


@pytest.mark.asyncio
async def test_async_api_client_request_timeout_is_a_deadline(
    test_api_key, stall_server
):
    reset_transport_caches()
    config = ConnectionConfig(
        api_key=test_api_key, api_url=stall_server, request_timeout=DEADLINE
    )
    async with get_async_api_client(config) as client:
        started = time.monotonic()
        with pytest.raises(httpx.TimeoutException):
            await client.get_async_httpx_client().get("/stall")
        _assert_deadline(time.monotonic() - started)


@pytest.mark.asyncio
async def test_async_envd_per_request_timeout_is_a_deadline(test_api_key, stall_server):
    reset_transport_caches()
    client = get_async_envd_api(ConnectionConfig(api_key=test_api_key), stall_server)
    started = time.monotonic()
    with pytest.raises(httpx.TimeoutException):
        await client.post("/stall", timeout=httpx.Timeout(DEADLINE, connect=60))
    _assert_deadline(time.monotonic() - started)


@pytest.mark.asyncio
async def test_async_disabled_timeout_waits_for_the_response(
    test_api_key, stall_server
):
    reset_transport_caches()
    client = get_async_envd_api(ConnectionConfig(api_key=test_api_key), stall_server)
    response = await asyncio.wait_for(
        client.get("/stall", timeout=httpx.Timeout(None)), STALL_SECONDS * 3
    )
    assert response.json() == {}
