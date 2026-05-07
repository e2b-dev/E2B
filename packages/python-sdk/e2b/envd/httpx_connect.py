from contextlib import asynccontextmanager, contextmanager
from typing import Any, AsyncIterator, Iterator, Mapping

import httpx
from pyqwest import FullResponse
from pyqwest import Headers as HTTPHeaders

from e2b.envd.rpc import STREAM_REQUEST_TIMEOUT_HEADER

_STREAM_REQUEST_TIMEOUT_HEADER = STREAM_REQUEST_TIMEOUT_HEADER.lower()


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
    if request_timeout is None:
        return timeout

    return httpx.Timeout(
        timeout=None,
        connect=request_timeout,
        read=timeout,
        write=request_timeout,
        pool=request_timeout,
    )


class _SyncStreamResponse:
    def __init__(self, response: httpx.Response) -> None:
        self.status = response.status_code
        self.headers = _headers(response.headers)
        self.trailers = HTTPHeaders()
        self.content = response.iter_bytes()


class _AsyncStreamResponse:
    def __init__(self, response: httpx.Response) -> None:
        self.status = response.status_code
        self.headers = _headers(response.headers)
        self.trailers = HTTPHeaders()
        self.content = response.aiter_bytes()


class HTTPXConnectClientSync:
    def __init__(self, transport: httpx.BaseTransport) -> None:
        self._client = httpx.Client(transport=transport)

    def get(
        self,
        url: str,
        headers: Any = None,
        *,
        timeout: float | None = None,
        params: Mapping[str, str] | None = None,
    ) -> FullResponse:
        headers, request_timeout = _prepare_headers(headers)
        response = self._client.get(
            url,
            headers=headers,
            timeout=_timeout(timeout, request_timeout),
            params=params,
        )
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
        response = self._client.post(
            url,
            headers=headers,
            content=content,
            timeout=_timeout(timeout, request_timeout),
            params=params,
        )
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
        with self._client.stream(
            method,
            url,
            headers=headers,
            content=content,
            timeout=_timeout(timeout, request_timeout),
            params=params,
        ) as response:
            yield _SyncStreamResponse(response)


class HTTPXConnectClient:
    def __init__(self, transport: httpx.AsyncBaseTransport) -> None:
        self._client = httpx.AsyncClient(transport=transport)

    async def get(
        self,
        url: str,
        headers: Any = None,
        *,
        timeout: float | None = None,
        params: Mapping[str, str] | None = None,
    ) -> FullResponse:
        headers, request_timeout = _prepare_headers(headers)
        response = await self._client.get(
            url,
            headers=headers,
            timeout=_timeout(timeout, request_timeout),
            params=params,
        )
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
        response = await self._client.post(
            url,
            headers=headers,
            content=content,
            timeout=_timeout(timeout, request_timeout),
            params=params,
        )
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
        async with self._client.stream(
            method,
            url,
            headers=headers,
            content=content,
            timeout=_timeout(timeout, request_timeout),
            params=params,
        ) as response:
            yield _AsyncStreamResponse(response)
