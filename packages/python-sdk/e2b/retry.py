"""Retry API responses marked by the server or selected missing-header statuses."""

import asyncio
import random
import time
from typing import Awaitable, Callable, Optional

import httpx

from e2b.exceptions import InvalidArgumentException

MAX_RETRY_AFTER_SECONDS = 2_147_483_647
MAX_RETRY_WAIT_WITHOUT_TIMEOUT_SECONDS = 60.0
BACKOFF_BASE_SECONDS = 0.1
BACKOFF_MAX_SECONDS = 10.0
BACKOFF_JITTER_MIN = 0.5
RETRYABLE_STATUSES = frozenset({429, 502, 503, 504})
IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"


def resolve_max_retries(retries: int) -> int:
    if isinstance(retries, bool) or not isinstance(retries, int) or retries < 0:
        raise InvalidArgumentException(
            f"Invalid retries={retries!r}: expected a non-negative integer."
        )
    return retries


def resolve_idempotency_key(key: Optional[str]) -> Optional[str]:
    if key is None:
        return None
    if not isinstance(key, str):
        raise InvalidArgumentException(
            f"Invalid idempotency_key: expected a string, got {type(key).__name__}."
        )
    if len(key) < 1 or len(key) > 255:
        raise InvalidArgumentException(
            f"Invalid idempotency_key: expected 1-255 characters, got {len(key)}."
        )
    return key


def parse_retry_after(value: Optional[str]) -> Optional[int]:
    if not value:
        return None

    value = value.strip()
    if not value.isascii() or not value.isdecimal() or len(value) > 10:
        return None
    delay = int(value)
    return delay if delay <= MAX_RETRY_AFTER_SECONDS else None


def _backoff_delay(attempt: int, random_: Callable[[], float]) -> float:
    backoff = min(BACKOFF_BASE_SECONDS * 2**attempt, BACKOFF_MAX_SECONDS)
    return backoff * (BACKOFF_JITTER_MIN + random_() * (1 - BACKOFF_JITTER_MIN))


def _retry_delay(
    response: httpx.Response,
    attempt: int,
    random_: Callable[[], float],
) -> Optional[float]:
    """Return a delay for marked responses or retryable statuses without a header.

    A present header is authoritative, including explicit ``false``.
    """
    should_retry = response.headers.get("Should-Retry")
    if should_retry is None:
        if response.status_code not in RETRYABLE_STATUSES:
            return None
    elif should_retry.strip().lower() != "true":
        return None

    retry_after = parse_retry_after(response.headers.get("Retry-After"))
    if retry_after is not None:
        return float(retry_after)

    return _backoff_delay(attempt, random_)


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
    """Retry marked API responses or 429/502/503/504 responses without a header."""

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
            response = self.transport.handle_request(
                _copy_request(request, remaining_timeout)
            )
            if attempt == self.retries:
                return response

            delay = _retry_delay(response, attempt, self._random)
            if delay is None or self._monotonic() + delay >= deadline:
                return response

            response.close()
            self._sleep(delay)

        raise AssertionError("unreachable")

    def close(self) -> None:
        # The underlying transport comes from a process-wide cache.
        pass


class AsyncRetryableTransport(httpx.AsyncBaseTransport):
    """Async transport with the same response retry policy as RetryableTransport."""

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
            response = await self.transport.handle_async_request(
                _copy_request(request, remaining_timeout)
            )
            if attempt == self.retries:
                return response

            delay = _retry_delay(response, attempt, self._random)
            if delay is None or self._monotonic() + delay >= deadline:
                return response

            await response.aclose()
            await self._sleep(delay)

        raise AssertionError("unreachable")

    async def aclose(self) -> None:
        # The underlying transport comes from a process-wide cache.
        pass
