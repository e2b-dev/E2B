"""Streamed request bodies pass through the shared retrying transports without
being mirrored in memory (SDK-332).

pyqwest's retry middleware keeps a request replayable, and for a body that is
not already ``bytes`` it does that by growing a copy of the body as it is sent.
An upload therefore reached the wire incrementally *and* was held whole in RAM,
so peak memory scaled with file size for ``files.write``, ``volume.write_file``
and template context uploads. The transports now declare
``unbuffered_retries``, which drops the copy and replays a streamed body only
while nothing has been read from it — all the connect-only policy needs, since
pyqwest starts reading a body when hyper first writes it and a connect error
means it never got that far.

``bytes`` bodies (every unary RPC payload, every in-memory write) are replayable
as they are, so their retries are unaffected; the tests for those live in
``test_envd_retry_transport.py``.

The tests that pin the unbuffered half are skipped on a pyqwest whose retry
middleware has no ``RetryMode``: there the SDK keeps that release's buffered
behavior, because going unbuffered without pyqwest's deferred body reads would
trade the copy for the connect retries.
"""

import socket
import tracemalloc
from typing import AsyncIterator, Iterator, List

import pytest
from pyqwest import (
    HTTPTransport,
    Request,
    Response,
    SyncHTTPTransport,
    SyncRequest,
    SyncResponse,
)

from e2b.api import unbuffered_retries
from e2b.api.client_async import ConnectionRetryTransport
from e2b.api.client_sync import (
    ConnectionRetryTransport as SyncConnectionRetryTransport,
)

CHUNK_SIZE = 256 * 1024
CHUNK_COUNT = 64
BODY_SIZE = CHUNK_SIZE * CHUNK_COUNT
"""16 MiB in 256 KiB chunks: large enough that a mirrored copy dwarfs the
per-chunk allocations, small enough to stay quick."""

unbuffered_only = pytest.mark.skipif(
    unbuffered_retries is True,
    reason="pyqwest without RetryMode buffers streamed bodies to replay them",
)

MAX_TRACED_PEAK = BODY_SIZE // 4


def _retrying(inner) -> ConnectionRetryTransport:
    # Keep the exponential backoff out of test wall-clock time.
    return ConnectionRetryTransport(
        inner, initial_interval=0.001, max_interval=0.002, max_retries=3
    )


def _retrying_sync(inner) -> SyncConnectionRetryTransport:
    return SyncConnectionRetryTransport(
        inner, initial_interval=0.001, max_interval=0.002, max_retries=3
    )


def _chunks(pulled: List[int]) -> Iterator[bytes]:
    """A streamed body that records how much of it was read."""
    for _ in range(CHUNK_COUNT):
        pulled.append(CHUNK_SIZE)
        yield b"x" * CHUNK_SIZE


async def _achunks(pulled: List[int]) -> AsyncIterator[bytes]:
    for _ in range(CHUNK_COUNT):
        pulled.append(CHUNK_SIZE)
        yield b"x" * CHUNK_SIZE


def _refused_port() -> int:
    """A port nothing listens on, so connecting to it fails immediately."""
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


class SendingTransport:
    """Inner async transport that reads the request body the way reqwest does,
    after failing the first ``failures`` attempts the way a refused connect
    does — before the body was touched."""

    def __init__(self, failures: int = 0, fail_mid_body: bool = False):
        self.failures = failures
        self.fail_mid_body = fail_mid_body
        self.attempts = 0
        self.received = 0

    async def execute(self, request: Request) -> Response:
        self.attempts += 1
        if self.attempts <= self.failures and not self.fail_mid_body:
            raise ConnectionError("tcp connect error")
        content = request.content
        if isinstance(content, bytes):
            self.received += len(content)
        else:
            async for chunk in content:
                self.received += len(chunk)
                if self.attempts <= self.failures and self.fail_mid_body:
                    raise ConnectionError("tcp connect error")
        return Response(status=200, content=b"ok")


class SendingSyncTransport:
    def __init__(self, failures: int = 0, fail_mid_body: bool = False):
        self.failures = failures
        self.fail_mid_body = fail_mid_body
        self.attempts = 0
        self.received = 0

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        self.attempts += 1
        if self.attempts <= self.failures and not self.fail_mid_body:
            raise ConnectionError("tcp connect error")
        content = request.content
        if isinstance(content, bytes):
            self.received += len(content)
        else:
            for chunk in content:
                self.received += len(chunk)
                if self.attempts <= self.failures and self.fail_mid_body:
                    raise ConnectionError("tcp connect error")
        return SyncResponse(status=200, content=b"ok")


@unbuffered_only
async def test_async_streamed_body_is_not_mirrored_in_memory():
    inner = SendingTransport()
    pulled: List[int] = []
    request = Request("PUT", "http://sandbox.test/upload", content=_achunks(pulled))
    tracemalloc.start()
    try:
        response = await _retrying(inner).execute(request)
        peak = tracemalloc.get_traced_memory()[1]
    finally:
        tracemalloc.stop()
    assert response.status == 200
    # The whole body reached the transport, but only a chunk of it at a time.
    assert inner.received == BODY_SIZE
    assert sum(pulled) == BODY_SIZE
    assert peak < MAX_TRACED_PEAK, peak


@unbuffered_only
def test_sync_streamed_body_is_not_mirrored_in_memory():
    inner = SendingSyncTransport()
    pulled: List[int] = []
    request = SyncRequest("PUT", "http://sandbox.test/upload", content=_chunks(pulled))
    tracemalloc.start()
    try:
        response = _retrying_sync(inner).execute_sync(request)
        peak = tracemalloc.get_traced_memory()[1]
    finally:
        tracemalloc.stop()
    assert response.status == 200
    assert inner.received == BODY_SIZE
    assert sum(pulled) == BODY_SIZE
    assert peak < MAX_TRACED_PEAK, peak


async def test_async_failed_connect_replays_an_untouched_streamed_body():
    inner = SendingTransport(failures=1)
    pulled: List[int] = []
    request = Request("PUT", "http://sandbox.test/upload", content=_achunks(pulled))
    response = await _retrying(inner).execute(request)
    assert response.status == 200
    assert inner.attempts == 2
    # The retry sent the body from the start: nothing had been read from it.
    assert inner.received == BODY_SIZE


def test_sync_failed_connect_replays_an_untouched_streamed_body():
    inner = SendingSyncTransport(failures=1)
    pulled: List[int] = []
    request = SyncRequest("PUT", "http://sandbox.test/upload", content=_chunks(pulled))
    response = _retrying_sync(inner).execute_sync(request)
    assert response.status == 200
    assert inner.attempts == 2
    assert inner.received == BODY_SIZE


@unbuffered_only
async def test_async_streamed_body_is_not_replayed_once_it_was_read():
    # A body with no copy behind it cannot be rewound, so a failure that
    # arrives after the first chunk went out surfaces instead of replaying a
    # truncated request.
    inner = SendingTransport(failures=1, fail_mid_body=True)
    pulled: List[int] = []
    request = Request("PUT", "http://sandbox.test/upload", content=_achunks(pulled))
    with pytest.raises(ConnectionError):
        await _retrying(inner).execute(request)
    assert inner.attempts == 1


@unbuffered_only
def test_sync_streamed_body_is_not_replayed_once_it_was_read():
    inner = SendingSyncTransport(failures=1, fail_mid_body=True)
    pulled: List[int] = []
    request = SyncRequest("PUT", "http://sandbox.test/upload", content=_chunks(pulled))
    with pytest.raises(ConnectionError):
        _retrying_sync(inner).execute_sync(request)
    assert inner.attempts == 1


# Through a real pyqwest transport: the retries above are only safe because a
# connect failure leaves the body unread, which is what lets the middleware
# hand the same iterator to the next attempt.


@unbuffered_only
async def test_async_refused_connect_leaves_a_streamed_body_unread():
    url = f"http://127.0.0.1:{_refused_port()}/upload"
    pulled: List[int] = []
    with pytest.raises(ConnectionError):
        await _retrying(HTTPTransport()).execute(
            Request("PUT", url, content=_achunks(pulled))
        )
    assert pulled == []


@unbuffered_only
def test_sync_refused_connect_leaves_a_streamed_body_unread():
    url = f"http://127.0.0.1:{_refused_port()}/upload"
    pulled: List[int] = []
    with pytest.raises(ConnectionError):
        _retrying_sync(SyncHTTPTransport()).execute_sync(
            SyncRequest("PUT", url, content=_chunks(pulled))
        )
    assert pulled == []
