"""Streamed request bodies pass through the shared retrying transports without
being mirrored in memory (SDK-332).

pyqwest's retry middleware keeps a request replayable, and for a body that is
not already ``bytes`` it does that by growing a copy of the body as it is sent.
An upload therefore reached the wire incrementally *and* was held whole in RAM,
so peak memory scaled with file size for ``files.write`` of a file-like object
and for ``volume.write_file`` (template context uploads build their own
transport with no retry middleware, so they were never affected). The transports
now declare ``_retry_request_policy``, which drops the copy and replays a
streamed body only while nothing has been read from it — all the connect-only
policy needs, since pyqwest starts reading a body when hyper first writes it and
a connect error means it never got that far.

``bytes`` bodies (every unary RPC payload, every in-memory write) are replayable
as they are, so their retries are unaffected; the tests for those live in
``test_envd_retry_transport.py``.

Which policy is in force depends on the installed pyqwest, so the tests come in
two halves keyed on whether its retry middleware exposes ``RetryMode``:
``unbuffered_only`` pins the unbuffered behavior, ``buffered_only`` pins the
buffered replay older releases ship, and one always-running test reports which
half is live so a pyqwest bump cannot switch them over unnoticed. The rest —
the policy resolution, the overrides being declared at all, and what the httpx
adapter hands the middleware — run on every release.
"""

import io
import socket
import tracemalloc
from types import SimpleNamespace
from typing import AsyncIterator, Iterator, List

import httpx
import pytest
from pyqwest import (
    HTTPTransport,
    Request,
    Response,
    SyncHTTPTransport,
    SyncRequest,
    SyncResponse,
)
from pyqwest.httpx import AsyncPyqwestTransport, PyqwestTransport
from pyqwest.middleware import retry as retry_middleware

from e2b.api import _resolve_retry_request_policy, _retry_request_policy
from e2b.api.client_async import ConnectionRetryTransport
from e2b.api.client_sync import (
    ConnectionRetryTransport as SyncConnectionRetryTransport,
)

PYQWEST_RETRY_MODE = getattr(retry_middleware, "RetryMode", None)
"""``pyqwest.middleware.retry.RetryMode``, or ``None`` on a release without it."""

CHUNK_SIZE = 256 * 1024
CHUNK_COUNT = 64
BODY_SIZE = CHUNK_SIZE * CHUNK_COUNT
"""16 MiB in 256 KiB chunks: large enough that a mirrored copy dwarfs the
per-chunk allocations, small enough to stay quick."""

# Keyed on the capability rather than on `_retry_request_policy`'s value, so a
# wrong value fails a test instead of quietly turning it into a skip.
unbuffered_only = pytest.mark.skipif(
    PYQWEST_RETRY_MODE is None,
    reason="pyqwest without RetryMode buffers streamed bodies to replay them",
)
buffered_only = pytest.mark.skipif(
    PYQWEST_RETRY_MODE is not None,
    reason="pyqwest with RetryMode replays streamed bodies only while unread",
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
    does — before the body was touched, unless ``fail_mid_body``.

    ``streamed`` records, per attempt, whether the body arrived as something
    other than ``bytes``: that is the shape the middleware replays by copying."""

    def __init__(self, failures: int = 0, fail_mid_body: bool = False):
        self.failures = failures
        self.fail_mid_body = fail_mid_body
        self.attempts = 0
        self.received = 0
        self.streamed: List[bool] = []

    async def execute(self, request: Request) -> Response:
        self.attempts += 1
        if self.attempts <= self.failures and not self.fail_mid_body:
            raise ConnectionError("tcp connect error")
        content = request.content
        self.streamed.append(not isinstance(content, bytes))
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
        self.streamed: List[bool] = []

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        self.attempts += 1
        if self.attempts <= self.failures and not self.fail_mid_body:
            raise ConnectionError("tcp connect error")
        content = request.content
        self.streamed.append(not isinstance(content, bytes))
        if isinstance(content, bytes):
            self.received += len(content)
        else:
            for chunk in content:
                self.received += len(chunk)
                if self.attempts <= self.failures and self.fail_mid_body:
                    raise ConnectionError("tcp connect error")
        return SyncResponse(status=200, content=b"ok")


# What the transports declare, on every pyqwest release: the resolution of the
# policy, and the fact that they override the hook at all. Neither depends on
# which policy is in force, and both are invisible to the behavioral tests
# below on a release where the inherited default happens to match.


def test_policy_is_pyqwests_unbuffered_mode_when_the_release_has_it():
    mode = SimpleNamespace(UNBUFFERED=object())
    assert _resolve_retry_request_policy(SimpleNamespace(RetryMode=mode)) is (
        mode.UNBUFFERED
    )


def test_policy_falls_back_to_buffered_retries_without_retry_mode():
    # `True` is what the middleware understood before the mode existed.
    assert _resolve_retry_request_policy(SimpleNamespace()) is True


def test_policy_matches_the_installed_pyqwest():
    # The two halves of this module are gated on the same capability, so this
    # says out loud which half is live: a pyqwest bump flips it rather than
    # quietly switching six tests from skipped to running.
    if PYQWEST_RETRY_MODE is None:
        assert _retry_request_policy is True
    else:
        assert _retry_request_policy is PYQWEST_RETRY_MODE.UNBUFFERED


@pytest.mark.parametrize(
    "transport",
    [SyncConnectionRetryTransport, ConnectionRetryTransport],
    ids=["sync", "async"],
)
def test_transports_declare_the_retry_policy(transport):
    # Inheriting pyqwest's default would restore the buffered replay silently,
    # so pin the override itself and not just its result.
    assert "should_retry_request" in transport.__dict__
    assert transport(None).should_retry_request(None) is _retry_request_policy


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
    # The retry sent the body from the start, reading the source exactly once:
    # nothing had been read from it when the connect failed.
    assert inner.received == BODY_SIZE
    assert sum(pulled) == BODY_SIZE


def test_sync_failed_connect_replays_an_untouched_streamed_body():
    inner = SendingSyncTransport(failures=1)
    pulled: List[int] = []
    request = SyncRequest("PUT", "http://sandbox.test/upload", content=_chunks(pulled))
    response = _retrying_sync(inner).execute_sync(request)
    assert response.status == 200
    assert inner.attempts == 2
    assert inner.received == BODY_SIZE
    assert sum(pulled) == BODY_SIZE


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
    assert inner.received == CHUNK_SIZE


@unbuffered_only
def test_sync_streamed_body_is_not_replayed_once_it_was_read():
    inner = SendingSyncTransport(failures=1, fail_mid_body=True)
    pulled: List[int] = []
    request = SyncRequest("PUT", "http://sandbox.test/upload", content=_chunks(pulled))
    with pytest.raises(ConnectionError):
        _retrying_sync(inner).execute_sync(request)
    assert inner.attempts == 1
    assert inner.received == CHUNK_SIZE


# The other half: on a pyqwest without `RetryMode` the copy the middleware
# grows is what makes the same failure retryable, which is why the fallback
# keeps it rather than going unbuffered without pyqwest's deferred body reads.


@buffered_only
async def test_async_buffered_streamed_body_is_replayed_from_the_copy():
    inner = SendingTransport(failures=1, fail_mid_body=True)
    pulled: List[int] = []
    request = Request("PUT", "http://sandbox.test/upload", content=_achunks(pulled))
    response = await _retrying(inner).execute(request)
    assert response.status == 200
    assert inner.attempts == 2
    # The first attempt sent one chunk; the replay resent it from the copy and
    # then streamed the rest, so the chunk went out twice.
    assert inner.received == CHUNK_SIZE + BODY_SIZE
    assert sum(pulled) == BODY_SIZE


@buffered_only
def test_sync_buffered_streamed_body_is_replayed_from_the_copy():
    inner = SendingSyncTransport(failures=1, fail_mid_body=True)
    pulled: List[int] = []
    request = SyncRequest("PUT", "http://sandbox.test/upload", content=_chunks(pulled))
    response = _retrying_sync(inner).execute_sync(request)
    assert response.status == 200
    assert inner.attempts == 2
    assert inner.received == CHUNK_SIZE + BODY_SIZE
    assert sum(pulled) == BODY_SIZE


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


# Through the httpx adapter, the way every affected call site reaches the
# middleware: `files.write` passes a file-like object as `content` or as a
# multipart part, `volume.write_file` passes `IO[bytes]` or an iterator. The
# adapter is what decides whether the middleware sees a replayable `bytes` body
# or the streamed one this policy is about, so the join is worth pinning — the
# transport-level tests above would all pass on a body the adapter had already
# flattened.

UPLOAD_URL = "http://sandbox.test/files?path=/home/user/upload.bin"


def _put_sync(client: httpx.Client, shape: str) -> httpx.Response:
    """``files.write``'s two upload shapes: the body as ``content``, and the
    same file-like object as a multipart part."""
    if shape == "content":
        return client.put(UPLOAD_URL, content=_chunks([]))
    return client.put(
        UPLOAD_URL, files={"file": ("upload.bin", io.BytesIO(b"x" * BODY_SIZE))}
    )


async def _put_async(client: httpx.AsyncClient, shape: str) -> httpx.Response:
    if shape == "content":
        return await client.put(UPLOAD_URL, content=_achunks([]))
    return await client.put(
        UPLOAD_URL, files={"file": ("upload.bin", io.BytesIO(b"x" * BODY_SIZE))}
    )


@pytest.mark.parametrize("shape", ["content", "multipart"])
def test_sync_httpx_hands_a_streamed_upload_to_the_middleware(shape):
    inner = SendingSyncTransport()
    with httpx.Client(transport=PyqwestTransport(_retrying_sync(inner))) as client:
        response = _put_sync(client, shape)
    assert response.status_code == 200
    assert inner.streamed == [True]
    # Multipart framing adds a little to the part itself.
    assert inner.received >= BODY_SIZE


@pytest.mark.parametrize("shape", ["content", "multipart"])
async def test_async_httpx_hands_a_streamed_upload_to_the_middleware(shape):
    inner = SendingTransport()
    async with httpx.AsyncClient(
        transport=AsyncPyqwestTransport(_retrying(inner))
    ) as client:
        response = await _put_async(client, shape)
    assert response.status_code == 200
    assert inner.streamed == [True]
    assert inner.received >= BODY_SIZE


@unbuffered_only
def test_sync_httpx_upload_is_not_mirrored_in_memory():
    inner = SendingSyncTransport()
    with httpx.Client(transport=PyqwestTransport(_retrying_sync(inner))) as client:
        tracemalloc.start()
        try:
            response = client.put(UPLOAD_URL, content=_chunks([]))
            peak = tracemalloc.get_traced_memory()[1]
        finally:
            tracemalloc.stop()
    assert response.status_code == 200
    assert inner.received == BODY_SIZE
    assert peak < MAX_TRACED_PEAK, peak


@unbuffered_only
async def test_async_httpx_upload_is_not_mirrored_in_memory():
    inner = SendingTransport()
    async with httpx.AsyncClient(
        transport=AsyncPyqwestTransport(_retrying(inner))
    ) as client:
        tracemalloc.start()
        try:
            response = await client.put(UPLOAD_URL, content=_achunks([]))
            peak = tracemalloc.get_traced_memory()[1]
        finally:
            tracemalloc.stop()
    assert response.status_code == 200
    assert inner.received == BODY_SIZE
    assert peak < MAX_TRACED_PEAK, peak
