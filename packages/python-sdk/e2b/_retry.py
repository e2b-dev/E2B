"""Shared retry primitives for the E2B SDK.

Provides transient-failure classification, ``Retry-After`` parsing, exponential
backoff with jitter, and retry drivers used by the httpx transports
(control-plane and volume REST).
"""

import asyncio
import os
import random
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Awaitable, Callable, Optional

import httpx

#: Default number of *retries* (i.e. attempts after the first).
DEFAULT_MAX_RETRIES = 3

_BACKOFF_BASE_SEC = 0.1
_BACKOFF_CAP_SEC = 8.0

#: HTTP methods that are idempotent per the HTTP spec and can be retried on any
#: transient failure.
_IDEMPOTENT_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "PUT", "DELETE"})

# A transient failure is either ``rejected`` (the server demonstrably did not
# process the request, so replaying is always safe) or ``ambiguous`` (the
# request may have been processed, so replaying is only safe for idempotent
# requests).
_REJECTED = "rejected"
_AMBIGUOUS = "ambiguous"

# ``500`` is intentionally excluded as it is frequently a deterministic error.
# Keep in sync with ``RETRYABLE_STATUS`` in the JS SDK (``src/retry.ts``).
_RETRYABLE_STATUS = {
    408: _AMBIGUOUS,  # request timeout
    429: _REJECTED,  # throttled — not processed
    502: _AMBIGUOUS,  # bad gateway
    503: _AMBIGUOUS,  # service unavailable — may be returned after processing
    504: _AMBIGUOUS,  # gateway timeout
}


def resolve_max_retries(retries: Optional[int]) -> int:
    """Resolve the configured number of retries, falling back to the
    ``E2B_MAX_RETRIES`` environment variable and finally
    :data:`DEFAULT_MAX_RETRIES`.
    """
    if retries is not None:
        if retries < 0:
            raise ValueError(
                f"Invalid retries={retries}: expected a non-negative integer."
            )
        return retries

    raw = os.getenv("E2B_MAX_RETRIES")
    if raw is None or raw == "":
        return DEFAULT_MAX_RETRIES

    value = int(raw)
    if value < 0:
        raise ValueError(
            f"Invalid E2B_MAX_RETRIES={raw}: expected a non-negative integer."
        )
    return value


def parse_retry_after(
    value: Optional[str], now: Optional[datetime] = None
) -> Optional[float]:
    """Parse a ``Retry-After`` header value (delta-seconds or HTTP date) into a
    delay in seconds. Returns ``None`` when missing or unparseable.
    """
    if not value:
        return None

    trimmed = value.strip()
    if trimmed.isdigit():
        return float(int(trimmed))

    try:
        date = parsedate_to_datetime(trimmed)
    except (TypeError, ValueError):
        return None
    if date is None:
        return None
    if date.tzinfo is None:
        date = date.replace(tzinfo=timezone.utc)

    current = now or datetime.now(timezone.utc)
    return max(0.0, (date - current).total_seconds())


def compute_delay(
    attempt: int,
    retry_after: Optional[float] = None,
    base: float = _BACKOFF_BASE_SEC,
    cap: float = _BACKOFF_CAP_SEC,
) -> float:
    """Compute the delay (seconds) before the next attempt. A server-provided
    ``Retry-After`` takes precedence; otherwise exponential backoff with full
    jitter is used.
    """
    if retry_after is not None:
        return min(retry_after, cap * 4)

    exp = min(cap, base * (2**attempt))
    return random.uniform(0, exp)


def _status_kind(status: int) -> Optional[str]:
    return _RETRYABLE_STATUS.get(status)


def classify_exception(exc: BaseException) -> Optional[str]:
    """Classify a transport exception as a transient failure kind, or ``None``
    when it is not retryable.
    """
    # Connection establishment failed — the request never reached the server.
    if isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout)):
        return _REJECTED
    # The request may have been sent/processed before the failure.
    if isinstance(
        exc,
        (
            httpx.ReadError,
            httpx.ReadTimeout,
            httpx.WriteError,
            httpx.WriteTimeout,
            httpx.PoolTimeout,
            httpx.RemoteProtocolError,
        ),
    ):
        return _AMBIGUOUS
    return None


def _should_retry(
    kind: Optional[str], attempt: int, retries: int, idempotent: bool
) -> bool:
    """Single decision point for both the response and error paths: retry only
    when attempts remain, the failure is transient, and the failure is safe to
    replay for this request. ``rejected`` failures are always safe; ``ambiguous``
    failures are only safe for idempotent requests.
    """
    if kind is None or attempt >= retries:
        return False
    return kind == _REJECTED or idempotent


def _is_replayable(request: httpx.Request) -> bool:
    # A bodyless request (``_content == b""``) or one whose body has been
    # buffered into bytes can be safely re-sent. A streaming (one-shot) body
    # has ``_content is None`` and must not be retried — regardless of method,
    # since DELETE/OPTIONS may also carry a streaming body.
    return getattr(request, "_content", None) is not None


def _is_idempotent(request: httpx.Request) -> bool:
    return request.method.upper() in _IDEMPOTENT_METHODS


def _operation_deadline(request: httpx.Request) -> Optional[float]:
    """Absolute :func:`time.monotonic` deadline bounding the whole operation
    (all attempts + backoff), derived from the per-request timeout httpx
    attached to the request. Returns ``None`` when no timeout applies.

    This mirrors the JS SDK, where a single ``AbortSignal`` bounds the entire
    retried operation rather than each individual attempt.
    """
    ext = request.extensions.get("timeout") if request.extensions else None
    if not ext:
        return None
    values = [v for v in ext.values() if v is not None]
    if not values:
        return None
    return time.monotonic() + max(values)


def _clamp_timeout(request: httpx.Request, deadline: Optional[float]) -> None:
    """Shrink the request's per-attempt timeout to the time remaining before
    ``deadline`` so a single attempt cannot overrun the whole-operation budget.
    """
    if deadline is None:
        return
    ext = request.extensions.get("timeout")
    if not ext:
        return
    remaining = max(0.0, deadline - time.monotonic())
    request.extensions = {
        **request.extensions,
        "timeout": {
            k: (min(v, remaining) if v is not None else v) for k, v in ext.items()
        },
    }


def _can_retry_before_deadline(deadline: Optional[float], delay: float) -> bool:
    """Whether a backoff of ``delay`` still leaves time for another attempt."""
    if deadline is None:
        return True
    return time.monotonic() + delay < deadline


def retry_request_sync(
    request: httpx.Request,
    send: Callable[[httpx.Request], httpx.Response],
    retries: int,
    sleep: Callable[[float], None] = time.sleep,
) -> httpx.Response:
    """Drive a sync request with retries on transient failures."""
    if retries <= 0 or not _is_replayable(request):
        return send(request)

    idempotent = _is_idempotent(request)
    deadline = _operation_deadline(request)
    attempt = 0
    while True:
        try:
            response = send(request)
        except Exception as exc:
            kind = classify_exception(exc)
            delay = compute_delay(attempt)
            if not _should_retry(
                kind, attempt, retries, idempotent
            ) or not _can_retry_before_deadline(deadline, delay):
                raise
            sleep(delay)
            _clamp_timeout(request, deadline)
            attempt += 1
            continue

        kind = _status_kind(response.status_code)
        retry_after = parse_retry_after(response.headers.get("retry-after"))
        delay = compute_delay(attempt, retry_after)
        if not _should_retry(
            kind, attempt, retries, idempotent
        ) or not _can_retry_before_deadline(deadline, delay):
            return response

        response.close()
        sleep(delay)
        _clamp_timeout(request, deadline)
        attempt += 1


async def retry_request_async(
    request: httpx.Request,
    send: Callable[[httpx.Request], Awaitable[httpx.Response]],
    retries: int,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> httpx.Response:
    """Drive an async request with retries on transient failures."""
    if retries <= 0 or not _is_replayable(request):
        return await send(request)

    idempotent = _is_idempotent(request)
    deadline = _operation_deadline(request)
    attempt = 0
    while True:
        try:
            response = await send(request)
        except Exception as exc:
            kind = classify_exception(exc)
            delay = compute_delay(attempt)
            if not _should_retry(
                kind, attempt, retries, idempotent
            ) or not _can_retry_before_deadline(deadline, delay):
                raise
            await sleep(delay)
            _clamp_timeout(request, deadline)
            attempt += 1
            continue

        kind = _status_kind(response.status_code)
        retry_after = parse_retry_after(response.headers.get("retry-after"))
        delay = compute_delay(attempt, retry_after)
        if not _should_retry(
            kind, attempt, retries, idempotent
        ) or not _can_retry_before_deadline(deadline, delay):
            return response

        await response.aclose()
        await sleep(delay)
        _clamp_timeout(request, deadline)
        attempt += 1
