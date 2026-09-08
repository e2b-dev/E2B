import asyncio
import time
from typing import Awaitable, Callable, Optional

import httpx

MAX_RETRY_AFTER_SECONDS = 2_147_483_647
REPLAYABLE_BODY_EXTENSION = "e2b_replayable_body"


def resolve_max_retries(retries: Optional[int]) -> int:
    if retries is None:
        return 0
    if isinstance(retries, bool) or not isinstance(retries, int) or retries < 0:
        raise ValueError(
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
        operation_phases = [
            key for key in ("read", "write") if adjusted_timeout.get(key) is not None
        ]
        operation_timeout = sum(
            max(adjusted_timeout[key], 0.0) for key in operation_phases
        )
        if operation_timeout > remaining_timeout:
            scale = remaining_timeout / operation_timeout
            for key in operation_phases:
                adjusted_timeout[key] = max(adjusted_timeout[key], 0.0) * scale
        extensions["timeout"] = adjusted_timeout

    return httpx.Request(
        request.method,
        request.url,
        headers=request.headers,
        content=request.content,
        extensions=extensions,
    )


def _request_deadline(
    request: httpx.Request, monotonic: Callable[[], float]
) -> Optional[float]:
    timeout = request.extensions.get("timeout")
    if not isinstance(timeout, dict):
        return None

    values = [value for value in timeout.values() if value is not None]
    # A monotonic clock cannot jump when the system wall clock is adjusted,
    # keeping elapsed timeout calculations stable across retries.
    return monotonic() + min(values) if values else None


class RateLimitTransport(httpx.BaseTransport):
    """Retry replayable requests after a 429 carrying ``Retry-After``."""

    def __init__(
        self,
        transport: httpx.BaseTransport,
        retries: int,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ):
        self.transport = transport
        self.retries = retries
        self._sleep = sleep
        self._monotonic = monotonic

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        # Iterators, files, and other streaming bodies may be consumed by the
        # first attempt and cannot be safely replayed without buffering them.
        replayable = (
            isinstance(request.stream, httpx.ByteStream)
            or request.extensions.get(REPLAYABLE_BODY_EXTENSION) is True
        )
        if self.retries == 0 or not replayable:
            return self.transport.handle_request(request)

        request.read()
        deadline = _request_deadline(request, self._monotonic)
        for attempt in range(self.retries + 1):
            remaining_timeout = None
            if attempt > 0 and deadline is not None:
                remaining_timeout = deadline - self._monotonic()
                if remaining_timeout <= 0:
                    raise httpx.TimeoutException(
                        "Request timeout exhausted while retrying", request=request
                    )
            response = self.transport.handle_request(
                _copy_request(request, remaining_timeout)
            )
            retry_after = parse_retry_after(response.headers.get("Retry-After"))
            if (
                response.status_code != 429
                or retry_after is None
                or attempt == self.retries
                or (
                    deadline is not None and self._monotonic() + retry_after >= deadline
                )
            ):
                return response

            response.close()
            self._sleep(retry_after)

        raise AssertionError("unreachable")

    def close(self) -> None:
        # The underlying transport comes from a process-wide cache.
        pass


class AsyncRateLimitTransport(httpx.AsyncBaseTransport):
    """Async counterpart of :class:`RateLimitTransport`."""

    def __init__(
        self,
        transport: httpx.AsyncBaseTransport,
        retries: int,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ):
        self.transport = transport
        self.retries = retries
        self._sleep = sleep
        self._monotonic = monotonic

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        # Iterators, files, and other streaming bodies may be consumed by the
        # first attempt and cannot be safely replayed without buffering them.
        replayable = (
            isinstance(request.stream, httpx.ByteStream)
            or request.extensions.get(REPLAYABLE_BODY_EXTENSION) is True
        )
        if self.retries == 0 or not replayable:
            return await self.transport.handle_async_request(request)

        await request.aread()
        deadline = _request_deadline(request, self._monotonic)
        for attempt in range(self.retries + 1):
            remaining_timeout = None
            if attempt > 0 and deadline is not None:
                remaining_timeout = deadline - self._monotonic()
                if remaining_timeout <= 0:
                    raise httpx.TimeoutException(
                        "Request timeout exhausted while retrying", request=request
                    )
            response = await self.transport.handle_async_request(
                _copy_request(request, remaining_timeout)
            )
            retry_after = parse_retry_after(response.headers.get("Retry-After"))
            if (
                response.status_code != 429
                or retry_after is None
                or attempt == self.retries
                or (
                    deadline is not None and self._monotonic() + retry_after >= deadline
                )
            ):
                return response

            await response.aclose()
            await self._sleep(retry_after)

        raise AssertionError("unreachable")

    async def aclose(self) -> None:
        # The underlying transport comes from a process-wide cache.
        pass
