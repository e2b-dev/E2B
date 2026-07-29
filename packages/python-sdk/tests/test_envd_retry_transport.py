"""Connection retries for envd RPCs live in pyqwest's transport middleware
(``ConnectionRetryTransport``), below connectrpc. The policy retries only the
builtin ``ConnectionError``, which pyqwest raises solely while establishing
the connection — before the request could have reached envd — so a retry can
never replay a delivered request (which could re-run a command or re-deliver
events), for unary and streaming RPCs alike.
"""

import pytest
from pyqwest import (
    HTTPTransport,
    HTTPVersion,
    Request,
    Response,
    SyncHTTPTransport,
    SyncRequest,
    SyncResponse,
    WriteError,
)
from envd_frame_server import (
    assert_stdout_event,
    frame_recording_server,
    make_async_client,
    make_sync_client,
)

from e2b.envd.client_async import ConnectionRetryTransport
from e2b.envd.client_sync import (
    ConnectionRetryTransport as SyncConnectionRetryTransport,
)
from e2b.envd.process.process_pb import ConnectRequest


def _retrying(inner) -> ConnectionRetryTransport:
    # Keep the exponential backoff out of test wall-clock time.
    return ConnectionRetryTransport(
        inner, initial_interval=0.001, max_interval=0.002, max_retries=3
    )


def _retrying_sync(inner) -> SyncConnectionRetryTransport:
    return SyncConnectionRetryTransport(
        inner, initial_interval=0.001, max_interval=0.002, max_retries=3
    )


class FakeTransport:
    """Inner async transport that raises the queued errors, then succeeds."""

    def __init__(self, errors=(), status: int = 200):
        self.errors = list(errors)
        self.status = status
        self.attempts = 0

    async def execute(self, request: Request) -> Response:
        self.attempts += 1
        if self.errors:
            raise self.errors.pop(0)
        return Response(status=self.status, content=b"ok")


class FakeSyncTransport:
    def __init__(self, errors=(), status: int = 200):
        self.errors = list(errors)
        self.status = status
        self.attempts = 0

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        self.attempts += 1
        if self.errors:
            raise self.errors.pop(0)
        return SyncResponse(status=self.status, content=b"ok")


def _request() -> Request:
    return Request("POST", "http://sandbox.test/rpc", content=b"payload")


def _sync_request() -> SyncRequest:
    return SyncRequest("POST", "http://sandbox.test/rpc", content=b"payload")


async def test_async_retries_failed_connects():
    inner = FakeTransport(errors=[ConnectionError("connect"), ConnectionError("dns")])
    response = await _retrying(inner).execute(_request())
    assert response.status == 200
    assert inner.attempts == 3


def test_sync_retries_failed_connects():
    inner = FakeSyncTransport(errors=[ConnectionError("connect")])
    response = _retrying_sync(inner).execute_sync(_sync_request())
    assert response.status == 200
    assert inner.attempts == 2


async def test_async_does_not_retry_after_request_was_sent():
    # A WriteError means the connection was up — the request may have reached
    # envd and started the command, so replaying it is not safe.
    inner = FakeTransport(errors=[WriteError("connection closed")])
    with pytest.raises(WriteError):
        await _retrying(inner).execute(_request())
    assert inner.attempts == 1


def test_sync_does_not_retry_after_request_was_sent():
    inner = FakeSyncTransport(errors=[WriteError("connection closed")])
    with pytest.raises(WriteError):
        _retrying_sync(inner).execute_sync(_sync_request())
    assert inner.attempts == 1


async def test_async_does_not_retry_error_responses():
    # An error response is envd (or a proxy) answering — a definitive result.
    # The middleware's default policy would retry 5xx for idempotent methods.
    inner = FakeTransport(status=502)
    response = await _retrying(inner).execute(_request())
    assert response.status == 502
    assert inner.attempts == 1


async def test_async_raises_last_connect_error_when_exhausted():
    inner = FakeTransport(errors=[ConnectionError("connect")] * 10)
    with pytest.raises(ConnectionError):
        await _retrying(inner).execute(_request())
    # `max_retries` extra attempts after the first.
    assert inner.attempts == 4


class ConnectFlakyTransport:
    """Delegating async transport whose first ``failures`` executions fail the
    way a refused TCP connect does."""

    def __init__(self, inner, failures: int = 1):
        self.inner = inner
        self.failures = failures
        self.attempts = 0

    async def execute(self, request: Request) -> Response:
        self.attempts += 1
        if self.attempts <= self.failures:
            raise ConnectionError("tcp connect error")
        return await self.inner.execute(request)


class ConnectFlakySyncTransport:
    def __init__(self, inner, failures: int = 1):
        self.inner = inner
        self.failures = failures
        self.attempts = 0

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        self.attempts += 1
        if self.attempts <= self.failures:
            raise ConnectionError("tcp connect error")
        return self.inner.execute_sync(request)


# End-to-end through the generated stub: verifies streaming RPCs route
# through the transport middleware (connectrpc opens streams via
# `Client.stream`, a different client path than unary `post`).


async def test_async_stream_setup_retries_failed_connects():
    with frame_recording_server(server_ends_stream=True) as server:
        flaky = ConnectFlakyTransport(HTTPTransport(http_version=HTTPVersion.HTTP2))
        client = make_async_client(server.port, transport=_retrying(flaky))
        events = [event async for event in client.connect(ConnectRequest())]
        assert len(events) == 1
        assert_stdout_event(events[0])
        assert flaky.attempts == 2


def test_sync_stream_setup_retries_failed_connects():
    with frame_recording_server(server_ends_stream=True) as server:
        flaky = ConnectFlakySyncTransport(
            SyncHTTPTransport(http_version=HTTPVersion.HTTP2)
        )
        client = make_sync_client(server.port, transport=_retrying_sync(flaky))
        events = list(client.connect(ConnectRequest()))
        assert len(events) == 1
        assert_stdout_event(events[0])
        assert flaky.attempts == 2
