import asyncio
import json
import random
import re
import time
from dataclasses import dataclass, field
from collections.abc import AsyncIterator, Iterator
from typing import (
    Awaitable,
    Callable,
    List,
    Optional,
    Tuple,
    Union,
)

import httpx

from e2b.exceptions import (
    SANDBOX_PAUSE_REFUSED_ERROR_CODE,
    InvalidArgumentException,
)

MAX_RETRY_AFTER_SECONDS = 2_147_483_647
MAX_RETRY_WAIT_WITHOUT_TIMEOUT_SECONDS = 60.0
BACKOFF_BASE_SECONDS = 0.1
BACKOFF_MAX_SECONDS = 10.0
BACKOFF_JITTER_MIN = 0.5
RETRYABLE_STATUSES = frozenset({429, 502, 503})
# A 503 whose body carries one of these ``error_code`` values is a decision by
# the server, not transient capacity, and is answered after a single request.
NON_RETRYABLE_ERROR_CODES = frozenset({SANDBOX_PAUSE_REFUSED_ERROR_CODE})
# An error body larger than this cannot carry a code worth parsing, so the peek
# stops there: such a 503 is retried while budget remains and handed on whole
# when it is exhausted.
MAX_ERROR_BODY_BYTES = 8 * 1024
# Wall-clock cap on peeking at a 503 body for its ``error_code``, measured
# across chunks; the JavaScript transport's PEEK_BUDGET_MS counterpart.
PEEK_BUDGET_SECONDS = 1.0

# GET/PUT/PATCH/DELETE are idempotent by HTTP semantics. A POST is retried
# after a 502 or a network error that may have occurred once the request was
# written only if it is listed here: a replay is a no-op or fails with a
# 404/409 the SDK already tolerates. POSTs that mint a resource without a
# client-supplied idempotency key (sandbox/fork/snapshot/API-key/volume/secret/
# webhook creation) or append to one (secret update) must stay off the list —
# a replay could create a duplicate — and so does any new POST until it is
# reviewed. (Connection-establishment
# failures are retried for every operation by ``ConnectionRetryTransport``
# underneath: the request never left.)
REPLAYABLE_METHODS = frozenset({"GET", "PUT", "PATCH", "DELETE"})
REPLAYABLE_OPERATIONS: List[Tuple[str, re.Pattern[str]]] = [
    ("POST", re.compile(r"^/sandboxes/[^/]+/(pause|resume|timeout|refreshes)$")),
    ("POST", re.compile(r"^/(v2/)?sandboxes/[^/]+/connect$")),
    ("POST", re.compile(r"^/v3/templates$")),
    ("POST", re.compile(r"^/v2/templates/[^/]+/builds/[^/]+$")),
    ("POST", re.compile(r"^/templates/tags$")),
    ("POST", re.compile(r"^/nodes/[^/]+$")),
    ("POST", re.compile(r"^/admin/teams/[^/]+/(sandboxes/kill|builds/cancel)$")),
]

# Raised by the pyqwest httpx adapter once the request was (at least partially)
# written: the connection dropped while sending it or awaiting the response.
# ``httpx.ConnectError``/``ConnectTimeout`` are excluded — the connection layer
# already retries those — as are timeouts, which exhaust the request's budget.
NETWORK_ERRORS = (httpx.ReadError, httpx.WriteError, httpx.RemoteProtocolError)


def resolve_max_retries(retries: int) -> int:
    if isinstance(retries, bool) or not isinstance(retries, int) or retries < 0:
        raise InvalidArgumentException(
            f"Invalid retries={retries!r}: expected a non-negative integer."
        )
    return retries


def parse_retry_after(value: Optional[str]) -> Optional[int]:
    if not value:
        return None

    value = value.strip()
    if not value.isascii() or not value.isdecimal() or len(value) > 10:
        return None
    delay = int(value)
    return delay if delay <= MAX_RETRY_AFTER_SECONDS else None


def is_replayable(request: httpx.Request) -> bool:
    """Whether ``request`` may be sent again after a 502 or a network error
    that may have occurred once it was written (see ``REPLAYABLE_OPERATIONS``)."""
    if request.method in REPLAYABLE_METHODS:
        return True
    path = request.url.path
    return any(
        request.method == method and pattern.match(path)
        for method, pattern in REPLAYABLE_OPERATIONS
    )


def _backoff_delay(attempt: int, random_: Callable[[], float]) -> float:
    backoff = min(BACKOFF_BASE_SECONDS * 2**attempt, BACKOFF_MAX_SECONDS)
    return backoff * (BACKOFF_JITTER_MIN + random_() * (1 - BACKOFF_JITTER_MIN))


def _retry_delay(
    response: httpx.Response,
    attempt: int,
    replayable: bool,
    random_: Callable[[], float],
) -> Optional[float]:
    """Delay before the next attempt, or ``None`` when the response is not
    retried: ``Retry-After`` when the server sends a usable one, otherwise
    exponential backoff with jitter for 502/503. A 429 without ``Retry-After``
    is not retried, nor is a 502 for a non-replayable request: a gateway may
    answer 502 after the backend already processed it."""
    if response.status_code not in RETRYABLE_STATUSES:
        return None
    if response.status_code == 502 and not replayable:
        return None

    retry_after = parse_retry_after(response.headers.get("Retry-After"))
    if retry_after is not None:
        return float(retry_after)
    if response.status_code == 429:
        return None

    return _backoff_delay(attempt, random_)


def _media_type(content_type: Optional[str]) -> str:
    """The media type of a ``Content-Type`` value: lower-cased, parameters
    dropped."""
    return (content_type or "").split(";", 1)[0].strip().lower()


def _should_read_error_body(response: httpx.Response) -> bool:
    """Whether a 503 body is worth reading for its ``error_code``: the status
    matches, the body is JSON, and it is not declared larger than
    ``MAX_ERROR_BODY_BYTES``. The read itself streams up to that cap (so a
    chunked or HTTP/2 body without ``Content-Length`` is read too). Each chunk
    is bounded by the request's read timeout as the transport applies it
    (pyqwest's operation timeout; none when the request timeout is disabled),
    and the whole peek by a wall-clock budget measured across chunks (see
    ``_read_error_body``). A read that fails, exceeds the cap or outlives the
    budget decides nothing: the 503 is retried while budget remains; with none
    left, a body past the cap or cut off by the budget is handed on whole and
    a failed read is re-raised."""
    if response.status_code != 503:
        return False
    if _media_type(response.headers.get("Content-Type")) != "application/json":
        return False
    length = response.headers.get("Content-Length")
    return not (
        length is not None and length.isdecimal() and int(length) > MAX_ERROR_BODY_BYTES
    )


@dataclass
class _Peek:
    """What peeking at a 503 body yielded: ``content`` is the whole body when
    it was read in full; otherwise ``buffered`` holds the chunks read before
    the peek stopped (at the byte cap or past the wall-clock budget) and
    ``rest`` the live iterator over the remainder, so the body can be handed
    on whole or released."""

    content: Optional[bytes] = None
    buffered: List[bytes] = field(default_factory=list)
    rest: Union[Iterator[bytes], AsyncIterator[bytes], None] = None


def _close_rest(peek: _Peek) -> None:
    """Release a peek's remaining body iterator (httpx hands out a generator)
    now rather than at garbage collection. A generator a reader is still
    running cannot be closed from outside; it is left to that reader."""
    close = getattr(peek.rest, "close", None)
    if close is not None:
        try:
            close()
        except (RuntimeError, ValueError):
            # "generator already executing": a reader owns it.
            pass


async def _aclose_rest(peek: _Peek) -> None:
    """Async counterpart of :func:`_close_rest`."""
    aclose = getattr(peek.rest, "aclose", None)
    if aclose is not None:
        try:
            await aclose()
        except (RuntimeError, ValueError):
            # "asynchronous generator is already running": a reader owns it.
            pass


def _read_error_body(
    response: httpx.Response, until: float, monotonic: Callable[[], float]
) -> _Peek:
    """Up to ``MAX_ERROR_BODY_BYTES`` of the (decoded) body. Stops, keeping
    the stream resumable, at the byte cap or once a wait for a further chunk
    began after ``until`` (``monotonic()``). A chunk whose wait began within
    the budget is kept whenever it arrives, so a complete body is never
    dropped for being slow; only waiting for more past the budget gives up."""
    chunks: List[bytes] = []
    size = 0
    stream = response.iter_bytes()
    while True:
        waited_from = monotonic()
        chunk = next(stream, None)
        if chunk is None:
            return _Peek(content=b"".join(chunks))
        chunks.append(chunk)
        size += len(chunk)
        if size > MAX_ERROR_BODY_BYTES or waited_from > until:
            return _Peek(buffered=chunks, rest=stream)


async def _aread_error_body(
    response: httpx.Response, until: float, monotonic: Callable[[], float]
) -> _Peek:
    """Async counterpart of :func:`_read_error_body`."""
    chunks: List[bytes] = []
    size = 0
    stream = response.aiter_bytes()
    while True:
        waited_from = monotonic()
        try:
            chunk = await stream.__anext__()
        except StopAsyncIteration:
            return _Peek(content=b"".join(chunks))
        chunks.append(chunk)
        size += len(chunk)
        if size > MAX_ERROR_BODY_BYTES or waited_from > until:
            return _Peek(buffered=chunks, rest=stream)


_TAIL_TIMEOUT_MESSAGE = (
    "Request timed out while reading the response body. "
    "Increase `request_timeout` or lower `retries`."
)


class _ResumedStream(httpx.SyncByteStream):
    """The peeked chunks followed by the rest of the original body, the tail
    bounded by the request deadline: a chunk whose wait would begin past it
    is not waited for; the inner response is closed and ``ReadTimeout`` is
    raised, so the client's read ends at the deadline instead of running on
    chunk by chunk. Since the peek's time counts against the retry delay, a
    budget exhausted after a peek means the clock is at the deadline, so in
    practice the caller gets what the peek buffered and then the timeout; a
    body the peek read in full, or buffered chunks that already form the
    refusal, are returned as content instead and never reach this stream."""

    def __init__(
        self,
        response: httpx.Response,
        peek: _Peek,
        request: httpx.Request,
        deadline: float,
        monotonic: Callable[[], float],
    ):
        self._response = response
        self._peek = peek
        self._request = request
        self._deadline = deadline
        self._monotonic = monotonic

    def __iter__(self) -> Iterator[bytes]:
        yield from self._peek.buffered
        rest = self._peek.rest
        if not isinstance(rest, Iterator):
            return
        while True:
            if self._monotonic() >= self._deadline:
                self.close()
                raise httpx.ReadTimeout(_TAIL_TIMEOUT_MESSAGE, request=self._request)
            chunk = next(rest, None)
            if chunk is None:
                return
            yield chunk

    def close(self) -> None:
        try:
            _close_rest(self._peek)
        finally:
            self._response.close()


class _AsyncResumedStream(httpx.AsyncByteStream):
    def __init__(
        self,
        response: httpx.Response,
        peek: _Peek,
        request: httpx.Request,
        deadline: float,
        monotonic: Callable[[], float],
    ):
        self._response = response
        self._peek = peek
        self._request = request
        self._deadline = deadline
        self._monotonic = monotonic

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self._peek.buffered:
            yield chunk
        rest = self._peek.rest
        if not isinstance(rest, AsyncIterator):
            return
        while True:
            if self._monotonic() >= self._deadline:
                await self.aclose()
                raise httpx.ReadTimeout(_TAIL_TIMEOUT_MESSAGE, request=self._request)
            try:
                chunk = await rest.__anext__()
            except StopAsyncIteration:
                return
            yield chunk

    async def aclose(self) -> None:
        try:
            await _aclose_rest(self._peek)
        finally:
            await self._response.aclose()


# Response extensions that are plain values and survive rebuilding the response;
# pyqwest's ``get_trailers`` is bound to the native response and is not copied.
_REBUILT_EXTENSIONS = ("http_version", "reason_phrase")


def _rebuild(
    response: httpx.Response,
    request: httpx.Request,
    *,
    content: Optional[bytes] = None,
    stream: Union[httpx.SyncByteStream, httpx.AsyncByteStream, None] = None,
) -> httpx.Response:
    """The response with its (partly) consumed stream replaced by ``content``
    or ``stream`` (httpx takes the stream when both are given), both decoded,
    so the encoding, transfer-encoding and length headers are dropped (httpx
    sets the length of a content body). ``request`` is the one being handled:
    the transport's response carries none yet, httpx attaches it after the
    transport returns."""
    headers = [
        (name, value)
        for name, value in response.headers.raw
        if name.lower()
        not in (b"content-encoding", b"transfer-encoding", b"content-length")
    ]
    return httpx.Response(
        response.status_code,
        headers=headers,
        content=content,
        stream=stream,
        request=request,
        extensions={
            key: value
            for key, value in response.extensions.items()
            if key in _REBUILT_EXTENSIONS
        },
    )


def _is_complete_json(content: bytes) -> bool:
    """Whether ``content`` parses as one complete JSON document."""
    try:
        json.loads(content)
    except (ValueError, RecursionError):
        return False
    return True


def _is_non_retryable_refusal(content: bytes) -> bool:
    """Whether a 503 body carries a non-retryable ``error_code`` (see
    ``NON_RETRYABLE_ERROR_CODES``)."""
    try:
        body = json.loads(content)
    except (ValueError, RecursionError):
        # Not JSON, or nested too deep to parse: not a refusal either way.
        return False
    if not isinstance(body, dict):
        return False
    code = body.get("error_code")
    return isinstance(code, str) and code in NON_RETRYABLE_ERROR_CODES


def _copy_request(
    request: httpx.Request, remaining_timeout: Optional[float] = None
) -> httpx.Request:
    extensions = dict(request.extensions)
    timeout = extensions.get("timeout")
    if remaining_timeout is not None and isinstance(timeout, dict):
        adjusted_timeout = {
            key: remaining_timeout if value is None else min(value, remaining_timeout)
            for key, value in timeout.items()
        }
        extensions["timeout"] = adjusted_timeout

    return httpx.Request(
        request.method,
        request.url,
        headers=request.headers,
        content=request.content,
        extensions=extensions,
    )


def _request_deadline(request: httpx.Request, monotonic: Callable[[], float]) -> float:
    timeout = request.extensions.get("timeout")
    if not isinstance(timeout, dict):
        return monotonic() + MAX_RETRY_WAIT_WITHOUT_TIMEOUT_SECONDS

    values = [value for value in timeout.values() if value is not None]
    # A monotonic clock cannot jump when the system wall clock is adjusted,
    # keeping elapsed timeout calculations stable across retries.
    return monotonic() + (
        min(values) if values else MAX_RETRY_WAIT_WITHOUT_TIMEOUT_SECONDS
    )


class RetryableTransport(httpx.BaseTransport):
    """Retry requests after a 429 carrying ``Retry-After`` or a 503, and — for
    replayable operations (``is_replayable``) — after a 502 (using
    ``Retry-After`` when present, exponential backoff otherwise) or a network
    error once the request was written. A 503 whose body carries a
    non-retryable ``error_code`` (a refused pause) is returned after one
    request."""

    def __init__(
        self,
        transport: httpx.BaseTransport,
        retries: int,
        *,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
        random_: Callable[[], float] = random.random,
    ):
        self.transport = transport
        self.retries = retries
        self._sleep = sleep
        self._monotonic = monotonic
        self._random = random_

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        # Iterators, files, and other streaming bodies may be consumed by the
        # first attempt and cannot be safely replayed without buffering them.
        if self.retries == 0 or not isinstance(request.stream, httpx.ByteStream):
            return self.transport.handle_request(request)

        request.read()
        deadline = _request_deadline(request, self._monotonic)
        replayable = is_replayable(request)
        for attempt in range(self.retries + 1):
            remaining_timeout = None
            if attempt > 0:
                remaining_timeout = deadline - self._monotonic()
                if remaining_timeout <= 0:
                    raise httpx.TimeoutException(
                        "Request timed out while waiting to retry. "
                        "Increase `request_timeout` or lower `retries`.",
                        request=request,
                    )
            try:
                response = self.transport.handle_request(
                    _copy_request(request, remaining_timeout)
                )
            except NETWORK_ERRORS:
                if attempt == self.retries or not replayable:
                    raise
                delay = _backoff_delay(attempt, self._random)
                if self._monotonic() + delay >= deadline:
                    raise
                self._sleep(delay)
                continue
            if attempt == self.retries:
                return response

            delay = _retry_delay(response, attempt, replayable, self._random)
            if delay is None or self._monotonic() + delay >= deadline:
                return response
            if _should_read_error_body(response):
                read_started = self._monotonic()
                peek_until = min(
                    read_started + max(delay, PEEK_BUDGET_SECONDS), deadline
                )
                peek = _Peek()
                read_error: Optional[Exception] = None
                try:
                    peek = _read_error_body(response, peek_until, self._monotonic)
                except (httpx.HTTPError, httpx.StreamError) as exc:
                    # A body that cannot be read decides nothing: retry as before.
                    read_error = exc
                except BaseException:
                    # Interrupted mid-peek: do not leak the connection.
                    response.close()
                    raise
                if peek.content is None and peek.rest is not None:
                    # Cut off on what was the last chunk: the buffered bytes are one
                    # complete JSON document, so they are the body read in full (a
                    # refusal or any other complete API error) and the tail is left
                    # unread; only a body that does not yet parse is handed on.
                    buffered = b"".join(peek.buffered)
                    if len(buffered) <= MAX_ERROR_BODY_BYTES and _is_complete_json(
                        buffered
                    ):
                        _close_rest(peek)
                        peek = _Peek(content=buffered)
                if peek.content is not None and _is_non_retryable_refusal(peek.content):
                    response.close()
                    return _rebuild(response, request, content=peek.content)
                # The time spent reading counts towards the delay.
                delay = max(0.0, delay - (self._monotonic() - read_started))
                if self._monotonic() + delay >= deadline:
                    # Out of budget: the 503 is the outcome, as on the
                    # JavaScript side. A body read in full is returned as is;
                    # one stopped at the byte cap or cut off by the peek budget
                    # is handed on whole, the peeked chunks first and the rest
                    # of the stream after; a failed read is reported as such,
                    # never as a fabricated body (the API client parses every
                    # 503 body as JSON).
                    if peek.content is not None:
                        response.close()
                        return _rebuild(response, request, content=peek.content)
                    if peek.rest is not None:
                        return _rebuild(
                            response,
                            request,
                            stream=_ResumedStream(
                                response, peek, request, deadline, self._monotonic
                            ),
                        )
                    response.close()
                    if read_error is not None:
                        raise read_error
                    raise AssertionError("unreachable")
                # Retrying: release what the peek left of the body.
                _close_rest(peek)

            response.close()
            self._sleep(delay)

        raise AssertionError("unreachable")

    def close(self) -> None:
        # The underlying transport comes from a process-wide cache.
        pass


class AsyncRetryableTransport(httpx.AsyncBaseTransport):
    """Async counterpart of :class:`RetryableTransport`."""

    def __init__(
        self,
        transport: httpx.AsyncBaseTransport,
        retries: int,
        *,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        monotonic: Callable[[], float] = time.monotonic,
        random_: Callable[[], float] = random.random,
    ):
        self.transport = transport
        self.retries = retries
        self._sleep = sleep
        self._monotonic = monotonic
        self._random = random_

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        # Iterators, files, and other streaming bodies may be consumed by the
        # first attempt and cannot be safely replayed without buffering them.
        if self.retries == 0 or not isinstance(request.stream, httpx.ByteStream):
            return await self.transport.handle_async_request(request)

        await request.aread()
        deadline = _request_deadline(request, self._monotonic)
        replayable = is_replayable(request)
        for attempt in range(self.retries + 1):
            remaining_timeout = None
            if attempt > 0:
                remaining_timeout = deadline - self._monotonic()
                if remaining_timeout <= 0:
                    raise httpx.TimeoutException(
                        "Request timed out while waiting to retry. "
                        "Increase `request_timeout` or lower `retries`.",
                        request=request,
                    )
            try:
                response = await self.transport.handle_async_request(
                    _copy_request(request, remaining_timeout)
                )
            except NETWORK_ERRORS:
                if attempt == self.retries or not replayable:
                    raise
                delay = _backoff_delay(attempt, self._random)
                if self._monotonic() + delay >= deadline:
                    raise
                await self._sleep(delay)
                continue
            if attempt == self.retries:
                return response

            delay = _retry_delay(response, attempt, replayable, self._random)
            if delay is None or self._monotonic() + delay >= deadline:
                return response
            if _should_read_error_body(response):
                read_started = self._monotonic()
                peek_until = min(
                    read_started + max(delay, PEEK_BUDGET_SECONDS), deadline
                )
                peek = _Peek()
                read_error: Optional[Exception] = None
                try:
                    peek = await _aread_error_body(
                        response, peek_until, self._monotonic
                    )
                except (httpx.HTTPError, httpx.StreamError) as exc:
                    # A body that cannot be read decides nothing: retry as before.
                    read_error = exc
                except BaseException:
                    # Interrupted mid-peek (e.g. cancelled): do not leak the
                    # connection.
                    await response.aclose()
                    raise
                if peek.content is None and peek.rest is not None:
                    # Cut off on what was the last chunk: the buffered bytes are one
                    # complete JSON document, so they are the body read in full (a
                    # refusal or any other complete API error) and the tail is left
                    # unread; only a body that does not yet parse is handed on.
                    buffered = b"".join(peek.buffered)
                    if len(buffered) <= MAX_ERROR_BODY_BYTES and _is_complete_json(
                        buffered
                    ):
                        await _aclose_rest(peek)
                        peek = _Peek(content=buffered)
                if peek.content is not None and _is_non_retryable_refusal(peek.content):
                    await response.aclose()
                    return _rebuild(response, request, content=peek.content)
                # The time spent reading counts towards the delay.
                delay = max(0.0, delay - (self._monotonic() - read_started))
                if self._monotonic() + delay >= deadline:
                    # Out of budget: the 503 is the outcome, as on the
                    # JavaScript side. A body read in full is returned as is;
                    # one stopped at the byte cap or cut off by the peek budget
                    # is handed on whole, the peeked chunks first and the rest
                    # of the stream after; a failed read is reported as such,
                    # never as a fabricated body (the API client parses every
                    # 503 body as JSON).
                    if peek.content is not None:
                        await response.aclose()
                        return _rebuild(response, request, content=peek.content)
                    if peek.rest is not None:
                        return _rebuild(
                            response,
                            request,
                            stream=_AsyncResumedStream(
                                response, peek, request, deadline, self._monotonic
                            ),
                        )
                    await response.aclose()
                    if read_error is not None:
                        raise read_error
                    raise AssertionError("unreachable")
                # Retrying: release what the peek left of the body.
                await _aclose_rest(peek)

            await response.aclose()
            await self._sleep(delay)

        raise AssertionError("unreachable")

    async def aclose(self) -> None:
        # The underlying transport comes from a process-wide cache.
        pass
