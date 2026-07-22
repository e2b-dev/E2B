from collections.abc import AsyncIterator, Iterator
from typing import Any

import httpx
import pytest

from e2b.api.http_client import AsyncRetryingClient, RetryingClient


GRACEFUL_GOAWAY = (
    "<ConnectionTerminated error_code:0, last_stream_id:41, additional_data:None>"
)


class GoAwayStream(httpx.SyncByteStream):
    def __iter__(self) -> Iterator[bytes]:
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)


class AsyncGoAwayStream(httpx.AsyncByteStream):
    async def __aiter__(self) -> AsyncIterator[bytes]:
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)
        yield b""  # pragma: no cover


@pytest.mark.parametrize("method", ["GET", "HEAD"])
def test_sync_retries_one_graceful_goaway_for_safe_methods(method: str):
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)
        return httpx.Response(200, content=b"ok")

    with RetryingClient(transport=httpx.MockTransport(handler)) as client:
        response = client.request(method, "https://example.com")

    assert response.status_code == 200
    assert attempts == 2


def test_sync_retries_goaway_while_buffering_the_response():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(200, stream=GoAwayStream())
        return httpx.Response(200, content=b"ok")

    with RetryingClient(transport=httpx.MockTransport(handler)) as client:
        assert client.get("https://example.com").content == b"ok"

    assert attempts == 2


@pytest.mark.parametrize(
    ("method", "kwargs", "error"),
    [
        ("POST", {}, httpx.RemoteProtocolError(GRACEFUL_GOAWAY)),
        ("GET", {"content": b"body"}, httpx.RemoteProtocolError(GRACEFUL_GOAWAY)),
        (
            "GET",
            {},
            httpx.RemoteProtocolError(
                "<ConnectionTerminated error_code:1, last_stream_id:41>"
            ),
        ),
        ("GET", {}, httpx.RemoteProtocolError("Server disconnected")),
    ],
)
def test_sync_does_not_retry_unsafe_requests_or_other_errors(
    method: str, kwargs: dict[str, Any], error: Exception
):
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise error

    with RetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(type(error)):
            client.request(method, "https://example.com", **kwargs)

    assert attempts == 1


def test_sync_surfaces_a_second_goaway():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)

    with RetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError):
            client.get("https://example.com")

    assert attempts == 2


@pytest.mark.parametrize("method", ["GET", "HEAD"])
async def test_async_retries_one_graceful_goaway_for_safe_methods(method: str):
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)
        return httpx.Response(200, content=b"ok")

    async with AsyncRetryingClient(transport=httpx.MockTransport(handler)) as client:
        response = await client.request(method, "https://example.com")

    assert response.status_code == 200
    assert attempts == 2


async def test_async_retries_goaway_while_buffering_the_response():
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(200, stream=AsyncGoAwayStream())
        return httpx.Response(200, content=b"ok")

    async with AsyncRetryingClient(transport=httpx.MockTransport(handler)) as client:
        assert (await client.get("https://example.com")).content == b"ok"

    assert attempts == 2


@pytest.mark.parametrize(
    ("method", "kwargs", "error"),
    [
        ("POST", {}, httpx.RemoteProtocolError(GRACEFUL_GOAWAY)),
        ("GET", {"content": b"body"}, httpx.RemoteProtocolError(GRACEFUL_GOAWAY)),
        (
            "GET",
            {},
            httpx.RemoteProtocolError(
                "<ConnectionTerminated error_code:1, last_stream_id:41>"
            ),
        ),
        ("GET", {}, httpx.RemoteProtocolError("Server disconnected")),
    ],
)
async def test_async_does_not_retry_unsafe_requests_or_other_errors(
    method: str, kwargs: dict[str, Any], error: Exception
):
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise error

    async with AsyncRetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(type(error)):
            await client.request(method, "https://example.com", **kwargs)

    assert attempts == 1
