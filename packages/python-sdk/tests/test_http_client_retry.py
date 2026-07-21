from collections.abc import AsyncIterator, Iterator
from typing import cast

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


@pytest.mark.parametrize("method", ["GET", "HEAD", "get", "head"])
def test_sync_retries_graceful_goaway_once_for_safe_methods(method: str):
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


def test_sync_retries_goaway_while_buffering_response_body():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(200, stream=GoAwayStream())
        return httpx.Response(200, content=b"ok")

    with RetryingClient(transport=httpx.MockTransport(handler)) as client:
        response = client.get("https://example.com")

    assert response.content == b"ok"
    assert attempts == 2


def test_sync_does_not_retry_get_with_one_shot_request_body():
    attempts = 0
    consumed = 0

    def body() -> Iterator[bytes]:
        nonlocal consumed
        consumed += 1
        yield b"payload"

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        stream = cast(httpx.SyncByteStream, request.stream)
        assert b"".join(stream) == b"payload"
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)

    with RetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError, match="error_code:0"):
            client.request("GET", "https://example.com", content=body())

    assert attempts == 1
    assert consumed == 1


def test_sync_propagates_second_graceful_goaway():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)

    with RetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError, match="error_code:0"):
            client.get("https://example.com")

    assert attempts == 2


@pytest.mark.parametrize(
    "exception",
    [
        httpx.RemoteProtocolError(
            "<ConnectionTerminated error_code:1, last_stream_id:41>"
        ),
        httpx.RemoteProtocolError(
            "<ConnectionTerminated error_code:0x1, last_stream_id:41>"
        ),
        httpx.RemoteProtocolError("Server disconnected"),
        httpx.LocalProtocolError(GRACEFUL_GOAWAY),
        httpx.ReadTimeout("timed out"),
    ],
)
def test_sync_does_not_retry_other_transport_errors(exception: Exception):
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise exception

    with RetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(type(exception)):
            client.get("https://example.com")

    assert attempts == 1


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_sync_does_not_retry_mutating_methods(method: str):
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)

    with RetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError):
            client.request(method, "https://example.com")

    assert attempts == 1


@pytest.mark.parametrize("stream_api", ["send", "stream"])
def test_sync_streaming_apis_bypass_retry(stream_api: str):
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)

    with RetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError):
            if stream_api == "send":
                request = client.build_request("GET", "https://example.com")
                client.send(request, stream=True)
            else:
                with client.stream("GET", "https://example.com"):
                    pass

    assert attempts == 1


@pytest.mark.parametrize("method", ["GET", "HEAD", "get", "head"])
async def test_async_retries_graceful_goaway_once_for_safe_methods(method: str):
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


async def test_async_retries_goaway_while_buffering_response_body():
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(200, stream=AsyncGoAwayStream())
        return httpx.Response(200, content=b"ok")

    async with AsyncRetryingClient(transport=httpx.MockTransport(handler)) as client:
        response = await client.get("https://example.com")

    assert response.content == b"ok"
    assert attempts == 2


async def test_async_does_not_retry_get_with_one_shot_request_body():
    attempts = 0
    consumed = 0

    async def body() -> AsyncIterator[bytes]:
        nonlocal consumed
        consumed += 1
        yield b"payload"

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        stream = cast(httpx.AsyncByteStream, request.stream)
        chunks = [chunk async for chunk in stream]
        assert b"".join(chunks) == b"payload"
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)

    async with AsyncRetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError, match="error_code:0"):
            await client.request("GET", "https://example.com", content=body())

    assert attempts == 1
    assert consumed == 1


async def test_async_propagates_second_graceful_goaway():
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)

    async with AsyncRetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError, match="error_code:0"):
            await client.get("https://example.com")

    assert attempts == 2


@pytest.mark.parametrize(
    "exception",
    [
        httpx.RemoteProtocolError(
            "<ConnectionTerminated error_code:1, last_stream_id:41>"
        ),
        httpx.RemoteProtocolError(
            "<ConnectionTerminated error_code:0x1, last_stream_id:41>"
        ),
        httpx.RemoteProtocolError("Server disconnected"),
        httpx.LocalProtocolError(GRACEFUL_GOAWAY),
        httpx.ReadTimeout("timed out"),
    ],
)
async def test_async_does_not_retry_other_transport_errors(exception: Exception):
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise exception

    async with AsyncRetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(type(exception)):
            await client.get("https://example.com")

    assert attempts == 1


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
async def test_async_does_not_retry_mutating_methods(method: str):
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)

    async with AsyncRetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError):
            await client.request(method, "https://example.com")

    assert attempts == 1


@pytest.mark.parametrize("stream_api", ["send", "stream"])
async def test_async_streaming_apis_bypass_retry(stream_api: str):
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.RemoteProtocolError(GRACEFUL_GOAWAY)

    async with AsyncRetryingClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.RemoteProtocolError):
            if stream_api == "send":
                request = client.build_request("GET", "https://example.com")
                await client.send(request, stream=True)
            else:
                async with client.stream("GET", "https://example.com"):
                    pass

    assert attempts == 1
