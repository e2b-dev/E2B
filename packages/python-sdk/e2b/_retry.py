"""Shared retry primitives for the E2B SDK.

Provides transient-failure classification, ``Retry-After`` parsing, exponential
backoff with jitter, idempotency-key helpers, and retry drivers used by the
httpx transports (control-plane and volume REST).
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
_RETRYABLE_STATUS = {
    408: _AMBIGUOUS,  # request timeout
    429: _REJECTED,  # throttled — not processed
    502: _AMBIGUOUS,  # bad gateway
    503: _REJECTED,  # service unavailable — not processed
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


def _may_retry(kind: str, idempotent: bool) -> bool:
    if kind == _REJECTED:
        return True
    return idempotent


def _is_replayable(request: httpx.Request) -> bool:
    # A request whose body has been buffered into bytes (``_content`` set) can be
    # safely re-sent. Streaming bodies are one-shot and must not be retried.
    if request.method.upper() in ("GET", "HEAD", "OPTIONS", "DELETE"):
        return True
    return getattr(request, "_content", None) is not None


def _is_idempotent(request: httpx.Request) -> bool:
    return request.method.upper() in _IDEMPOTENT_METHODS


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
    attempt = 0
    while True:
        try:
            response = send(request)
        except Exception as exc:
            kind = classify_exception(exc)
            if attempt >= retries or kind is None or not _may_retry(kind, idempotent):
                raise
            sleep(compute_delay(attempt))
            attempt += 1
            continue

        kind = _status_kind(response.status_code)
        if attempt >= retries or kind is None or not _may_retry(kind, idempotent):
            return response

        retry_after = parse_retry_after(response.headers.get("retry-after"))
        response.close()
        sleep(compute_delay(attempt, retry_after))
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
    attempt = 0
    while True:
        try:
            response = await send(request)
        except Exception as exc:
            kind = classify_exception(exc)
            if attempt >= retries or kind is None or not _may_retry(kind, idempotent):
                raise
            await sleep(compute_delay(attempt))
            attempt += 1
            continue

        kind = _status_kind(response.status_code)
        if attempt >= retries or kind is None or not _may_retry(kind, idempotent):
            return response

        retry_after = parse_retry_after(response.headers.get("retry-after"))
        await response.aclose()
        await sleep(compute_delay(attempt, retry_after))
        attempt += 1
