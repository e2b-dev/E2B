"""The shared retrying transports must not mirror streamed request bodies in
memory (SDK-332).

pyqwest's retry middleware keeps a request replayable, and for a body that is
not already ``bytes`` it does that by copying the stream into memory as it is
sent — a streamed upload (``files.write`` of a file-like object,
``volume.write_file``) reached the wire in chunks yet grew a full mirror in
RAM. ``ConnectionRetryTransport`` now returns ``RetryMode.UNBUFFERED`` from
``should_retry_request``, which replays a streamed body only while nothing has
been read from it — exactly what the connect-only retry policy needs, since a
``ConnectionError`` is raised only before the request was written.

``bytes`` bodies are replayable as they are — their retries are covered by
``test_envd_retry_transport.py``.
"""

import tracemalloc
from typing import AsyncIterator, Iterator, List

import httpx
import pytest
from pyqwest import Request, Response, SyncRequest, SyncResponse
from pyqwest.httpx import AsyncPyqwestTransport, PyqwestTransport
from pyqwest.middleware.retry import RetryMode

from e2b.api.client_async import ConnectionRetryTransport
from e2b.api.client_sync import (
    ConnectionRetryTransport as SyncConnectionRetryTransport,
)

CHUNK = 256 * 1024
CHUNKS = 64
BODY_SIZE = CHUNK * CHUNKS
"""16 MiB in 256 KiB chunks: a mirrored copy dwarfs the per-chunk allocations."""

# Well under BODY_SIZE, comfortably above the per-chunk working set.
MAX_UNBUFFERED_PEAK = BODY_SIZE // 4

UPLOAD_URL = "http://sandbox.test/files?path=/home/user/upload.bin"


def _chunks(pulled: List[int]) -> Iterator[bytes]:
    """A streamed body recording how much of it was read."""
    for _ in range(CHUNKS):
        pulled.append(CHUNK)
        yield b"x" * CHUNK


async def _achunks(pulled: List[int]) -> AsyncIterator[bytes]:
    for _ in range(CHUNKS):
        pulled.append(CHUNK)
        yield b"x" * CHUNK


class ReadingTransport:
    """Inner async transport that consumes the request body like reqwest does.

    The first ``connect_failures`` attempts raise the way a refused TCP
    connect does — before touching the body, or after the first chunk when
    ``after_first_chunk`` (the shape the middleware can only survive with a
    buffered copy). ``bodies`` records, per attempt, whether the body arrived
    still streaming (``True``) or as replayable ``bytes``."""

    def __init__(self, connect_failures: int = 0, after_first_chunk: bool = False):
        self.connect_failures = connect_failures
        self.after_first_chunk = after_first_chunk
        self.attempts = 0
        self.received = 0
        self.bodies: List[bool] = []

    async def execute(self, request: Request) -> Response:
        self.attempts += 1
        failing = self.attempts <= self.connect_failures
        if failing and not self.after_first_chunk:
            raise ConnectionError("tcp connect error")
        content = request.content
        self.bodies.append(not isinstance(content, bytes))
        if isinstance(content, bytes):
            self.received += len(content)
        else:
            async for chunk in content:
                self.received += len(chunk)
                if failing:
                    raise ConnectionError("tcp connect error")
        return Response(status=200, content=b"ok")


class ReadingSyncTransport:
    def __init__(self, connect_failures: int = 0, after_first_chunk: bool = False):
        self.connect_failures = connect_failures
        self.after_first_chunk = after_first_chunk
        self.attempts = 0
        self.received = 0
        self.bodies: List[bool] = []

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        self.attempts += 1
        failing = self.attempts <= self.connect_failures
        if failing and not self.after_first_chunk:
            raise ConnectionError("tcp connect error")
        content = request.content
        self.bodies.append(not isinstance(content, bytes))
        if isinstance(content, bytes):
            self.received += len(content)
        else:
            for chunk in content:
                self.received += len(chunk)
                if failing:
                    raise ConnectionError("tcp connect error")
        return SyncResponse(status=200, content=b"ok")


def _retrying(inner) -> ConnectionRetryTransport:
    # Keep the exponential backoff out of test wall-clock time.
    return ConnectionRetryTransport(
        inner, initial_interval=0.001, max_interval=0.002, max_retries=3
    )


def _retrying_sync(inner) -> SyncConnectionRetryTransport:
    return SyncConnectionRetryTransport(
        inner, initial_interval=0.001, max_interval=0.002, max_retries=3
    )


@pytest.mark.parametrize(
    "transport_cls",
    [SyncConnectionRetryTransport, ConnectionRetryTransport],
    ids=["sync", "async"],
)
def test_transports_declare_the_policy(transport_cls):
    # The inherited hook returns `True` — buffered — so nothing behavioral
    # below would fail loudly if the override silently vanished.
    assert "should_retry_request" in transport_cls.__dict__
    assert transport_cls(None).should_retry_request(None) is RetryMode.UNBUFFERED


# A failed connect leaves the body untouched, so the same stream serves the
# next attempt in either mode — the retries the SDK's policy is about.


async def test_async_failed_connect_replays_untouched_streamed_body():
    inner = ReadingTransport(connect_failures=1)
    pulled: List[int] = []
    request = Request("PUT", UPLOAD_URL, content=_achunks(pulled))
    response = await _retrying(inner).execute(request)
    assert response.status == 200
    assert inner.attempts == 2
    # The source was read exactly once: nothing had been pulled from it when
    # the connect failed.
    assert inner.received == BODY_SIZE
    assert sum(pulled) == BODY_SIZE


def test_sync_failed_connect_replays_untouched_streamed_body():
    inner = ReadingSyncTransport(connect_failures=1)
    pulled: List[int] = []
    request = SyncRequest("PUT", UPLOAD_URL, content=_chunks(pulled))
    response = _retrying_sync(inner).execute_sync(request)
    assert response.status == 200
    assert inner.attempts == 2
    assert inner.received == BODY_SIZE
    assert sum(pulled) == BODY_SIZE


# No mirror grows while the body is sent, and a body that was already read
# cannot be replayed (truncated replays would be worse than the error).


async def test_async_streamed_body_is_not_mirrored():
    inner = ReadingTransport()
    pulled: List[int] = []
    request = Request("PUT", UPLOAD_URL, content=_achunks(pulled))
    tracemalloc.start()
    try:
        response = await _retrying(inner).execute(request)
        peak = tracemalloc.get_traced_memory()[1]
    finally:
        tracemalloc.stop()
    assert response.status == 200
    assert inner.received == BODY_SIZE
    assert peak < MAX_UNBUFFERED_PEAK, peak


def test_sync_streamed_body_is_not_mirrored():
    inner = ReadingSyncTransport()
    pulled: List[int] = []
    request = SyncRequest("PUT", UPLOAD_URL, content=_chunks(pulled))
    tracemalloc.start()
    try:
        response = _retrying_sync(inner).execute_sync(request)
        peak = tracemalloc.get_traced_memory()[1]
    finally:
        tracemalloc.stop()
    assert response.status == 200
    assert inner.received == BODY_SIZE
    assert peak < MAX_UNBUFFERED_PEAK, peak


async def test_async_started_streamed_body_is_not_replayed():
    inner = ReadingTransport(connect_failures=1, after_first_chunk=True)
    request = Request("PUT", UPLOAD_URL, content=_achunks([]))
    with pytest.raises(ConnectionError):
        await _retrying(inner).execute(request)
    assert inner.attempts == 1
    assert inner.received == CHUNK


def test_sync_started_streamed_body_is_not_replayed():
    inner = ReadingSyncTransport(connect_failures=1, after_first_chunk=True)
    request = SyncRequest("PUT", UPLOAD_URL, content=_chunks([]))
    with pytest.raises(ConnectionError):
        _retrying_sync(inner).execute_sync(request)
    assert inner.attempts == 1
    assert inner.received == CHUNK


# Through the httpx adapter — the way every affected call site reaches the
# middleware. The adapter decides whether the middleware sees replayable
# `bytes` or the stream this policy is about, so pin that a streamed upload
# arrives still streaming.


def test_sync_httpx_upload_reaches_the_middleware_streaming():
    inner = ReadingSyncTransport()
    with httpx.Client(transport=PyqwestTransport(_retrying_sync(inner))) as client:
        response = client.put(UPLOAD_URL, content=_chunks([]))
    assert response.status_code == 200
    assert inner.bodies == [True]
    assert inner.received == BODY_SIZE


async def test_async_httpx_upload_reaches_the_middleware_streaming():
    inner = ReadingTransport()
    async with httpx.AsyncClient(
        transport=AsyncPyqwestTransport(_retrying(inner))
    ) as client:
        response = await client.put(UPLOAD_URL, content=_achunks([]))
    assert response.status_code == 200
    assert inner.bodies == [True]
    assert inner.received == BODY_SIZE
