from contextlib import asynccontextmanager, contextmanager
from typing import Any, AsyncIterator, Iterator, Mapping

import httpx
from pyqwest import FullResponse
from pyqwest import Headers as HTTPHeaders


def _headers(headers: httpx.Headers) -> HTTPHeaders:
    return HTTPHeaders(headers.multi_items())


def _request_headers(headers) -> Any:
    if headers is None:
        return None

    if hasattr(headers, "items"):
        return headers.items()

    return headers


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
        response = self._client.get(
            url,
            headers=_request_headers(headers),
            timeout=timeout,
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
        response = self._client.post(
            url,
            headers=_request_headers(headers),
            content=content,
            timeout=timeout,
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
        with self._client.stream(
            method,
            url,
            headers=_request_headers(headers),
            content=content,
            timeout=timeout,
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
        response = await self._client.get(
            url,
            headers=_request_headers(headers),
            timeout=timeout,
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
        response = await self._client.post(
            url,
            headers=_request_headers(headers),
            content=content,
            timeout=timeout,
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
        async with self._client.stream(
            method,
            url,
            headers=_request_headers(headers),
            content=content,
            timeout=timeout,
            params=params,
        ) as response:
            yield _AsyncStreamResponse(response)
