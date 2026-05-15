from contextlib import asynccontextmanager, contextmanager
from typing import Any, AsyncIterable, AsyncIterator, Iterable, Iterator, Mapping

import httpx
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from pyqwest import FullResponse
from pyqwest import Headers as HTTPHeaders

from e2b.envd.rpc import STREAM_REQUEST_TIMEOUT_HEADER

_STREAM_REQUEST_TIMEOUT_HEADER = STREAM_REQUEST_TIMEOUT_HEADER.lower()
_REMOTE_PROTOCOL_RETRIES = 3


def _headers(headers: httpx.Headers) -> HTTPHeaders:
    return HTTPHeaders(headers.multi_items())


def _prepare_headers(headers) -> tuple[Any, float | None]:
    if headers is None:
        return None, None

    if hasattr(headers, "items"):
        items = list(headers.items())
    else:
        items = list(headers)

    request_timeout = None
    filtered_headers = []
    for name, value in items:
        if name.lower() == _STREAM_REQUEST_TIMEOUT_HEADER:
            request_timeout = float(value)
            continue

        filtered_headers.append((name, value))

    return filtered_headers, request_timeout


def _timeout(timeout: float | None, request_timeout: float | None) -> Any:
    if request_timeout is None or request_timeout == 0:
        return timeout

    return httpx.Timeout(
        timeout=None,
        connect=request_timeout,
        read=timeout,
        write=request_timeout,
        pool=request_timeout,
    )


def _stream_timeout(timeout: float | None, request_timeout: float | None) -> Any:
    if request_timeout is None or request_timeout == 0:
        return httpx.Timeout(
            timeout=None,
            connect=None,
            read=timeout,
            write=None,
            pool=None,
        )

    return _timeout(timeout, request_timeout)


def _request_timeout_error(e: httpx.TimeoutException) -> ConnectError:
    return ConnectError(Code.CANCELED, str(e) or "Request timed out")


def _stream_timeout_error(e: httpx.TimeoutException) -> ConnectError:
    if isinstance(e, httpx.ReadTimeout):
        return ConnectError(Code.DEADLINE_EXCEEDED, str(e) or "Stream timed out")

    return _request_timeout_error(e)


def _retry_remote_protocol(call):
    for _ in range(_REMOTE_PROTOCOL_RETRIES):
        try:
            return call()
        except httpx.RemoteProtocolError:
            pass

    return call()


async def _aretry_remote_protocol(call):
    for _ in range(_REMOTE_PROTOCOL_RETRIES):
        try:
            return await call()
        except httpx.RemoteProtocolError:
            pass

    return await call()


def _sync_content(content):
    if isinstance(content, Iterable) and not isinstance(
        content, (bytes, bytearray, str)
    ):
        return list(content)

    return content


async def _async_content(content):
    if isinstance(content, AsyncIterable):
        return b"".join([chunk async for chunk in content])

    if isinstance(content, Iterable) and not isinstance(
        content, (bytes, bytearray, str)
    ):
        return b"".join(content)

    return content


class _SyncStreamResponse:
    def __init__(self, response: httpx.Response) -> None:
        self.status = response.status_code
        self.headers = _headers(response.headers)
        self.trailers = HTTPHeaders()
        self.content = _iter_stream_bytes(response)


class _AsyncStreamResponse:
    def __init__(self, response: httpx.Response) -> None:
        self.status = response.status_code
        self.headers = _headers(response.headers)
        self.trailers = HTTPHeaders()
        self.content = _aiter_stream_bytes(response)


def _iter_stream_bytes(response: httpx.Response):
    try:
        yield from response.iter_bytes()
    except httpx.TimeoutException as e:
        raise _stream_timeout_error(e) from e


async def _aiter_stream_bytes(response: httpx.Response):
    try:
        async for chunk in response.aiter_bytes():
            yield chunk
    except httpx.TimeoutException as e:
        raise _stream_timeout_error(e) from e


@contextmanager
def _open_stream(open_stream):
    try:
        with open_stream() as response:
            yield response
    except httpx.TimeoutException as e:
        raise _request_timeout_error(e) from e


@asynccontextmanager
async def _aopen_stream(open_stream):
    try:
        async with open_stream() as response:
            yield response
    except httpx.TimeoutException as e:
        raise _request_timeout_error(e) from e


class PyqwestHTTPXAdapter:
    def __init__(self, transport: httpx.BaseTransport) -> None:
        self._client = httpx.Client(transport=transport, timeout=None)

    def get(
        self,
        url: str,
        headers: Any = None,
        *,
        timeout: float | None = None,
        params: Mapping[str, str] | None = None,
    ) -> FullResponse:
        headers, request_timeout = _prepare_headers(headers)
        try:
            response = _retry_remote_protocol(
                lambda: self._client.get(
                    url,
                    headers=headers,
                    timeout=_timeout(timeout, request_timeout),
                    params=params,
                )
            )
        except httpx.TimeoutException as e:
            raise _request_timeout_error(e) from e

        return FullResponse(
            response.status_code,
            _headers(response.headers),
            response.content,
            HTTPHeaders(),
        )

    def post(
        self,
        url: str,
        headers: Any = None,
        content=None,
        *,
        timeout: float | None = None,
        params: Mapping[str, str] | None = None,
    ) -> FullResponse:
        headers, request_timeout = _prepare_headers(headers)
        content = _sync_content(content)
        try:
            response = _retry_remote_protocol(
                lambda: self._client.post(
                    url,
                    headers=headers,
                    content=content,
                    timeout=_timeout(timeout, request_timeout),
                    params=params,
                )
            )
        except httpx.TimeoutException as e:
            raise _request_timeout_error(e) from e

        return FullResponse(
            response.status_code,
            _headers(response.headers),
            response.content,
            HTTPHeaders(),
        )

    @contextmanager
    def stream(
        self,
        method: str,
        url: str,
        headers: Any = None,
        content=None,
        *,
        timeout: float | None = None,
        params: Mapping[str, str] | None = None,
    ) -> Iterator[_SyncStreamResponse]:
        headers, request_timeout = _prepare_headers(headers)
        content = _sync_content(content)

        def open_stream():
            return self._client.stream(
                method,
                url,
                headers=headers,
                content=content,
                timeout=_stream_timeout(timeout, request_timeout),
                params=params,
            )

        with _open_stream(open_stream) as response:
            yield _SyncStreamResponse(response)


class AsyncPyqwestHTTPXAdapter:
    def __init__(self, transport: httpx.AsyncBaseTransport) -> None:
        self._client = httpx.AsyncClient(transport=transport, timeout=None)

    async def get(
        self,
        url: str,
        headers: Any = None,
        *,
        timeout: float | None = None,
        params: Mapping[str, str] | None = None,
    ) -> FullResponse:
        headers, request_timeout = _prepare_headers(headers)
        try:
            response = await _aretry_remote_protocol(
                lambda: self._client.get(
                    url,
                    headers=headers,
                    timeout=_timeout(timeout, request_timeout),
                    params=params,
                )
            )
        except httpx.TimeoutException as e:
            raise _request_timeout_error(e) from e

        return FullResponse(
            response.status_code,
            _headers(response.headers),
            response.content,
            HTTPHeaders(),
        )

    async def post(
        self,
        url: str,
        headers: Any = None,
        content=None,
        *,
        timeout: float | None = None,
        params: Mapping[str, str] | None = None,
    ) -> FullResponse:
        headers, request_timeout = _prepare_headers(headers)
        content = await _async_content(content)
        try:
            response = await _aretry_remote_protocol(
                lambda: self._client.post(
                    url,
                    headers=headers,
                    content=content,
                    timeout=_timeout(timeout, request_timeout),
                    params=params,
                )
            )
        except httpx.TimeoutException as e:
            raise _request_timeout_error(e) from e

        return FullResponse(
            response.status_code,
            _headers(response.headers),
            response.content,
            HTTPHeaders(),
        )

    @asynccontextmanager
    async def stream(
        self,
        method: str,
        url: str,
        headers: Any = None,
        content=None,
        *,
        timeout: float | None = None,
        params: Mapping[str, str] | None = None,
    ) -> AsyncIterator[_AsyncStreamResponse]:
        headers, request_timeout = _prepare_headers(headers)
        content = await _async_content(content)

        def open_stream():
            return self._client.stream(
                method,
                url,
                headers=headers,
                content=content,
                timeout=_stream_timeout(timeout, request_timeout),
                params=params,
            )

        async with _aopen_stream(open_stream) as response:
            yield _AsyncStreamResponse(response)
