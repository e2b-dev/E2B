import asyncio
import json
import logging
import os
import re
import socket
import sys
import threading
import weakref
from dataclasses import dataclass
from types import TracebackType
from typing import Any, Callable, Iterable, Optional, Protocol, TypeVar, Union, cast

import httpcore
import httpx
from httpx import AsyncBaseTransport, BaseTransport, Limits, Timeout

# NOTE: httpx private API. Kept in sync with the `httpx>=0.27.0,<1.0.0` pin in
# pyproject.toml — re-verify this import when bumping httpx.
from httpx._utils import get_environment_proxies

from e2b.api.client.client import AuthenticatedClient
from e2b.api.client.types import Response
from e2b.api.metadata import default_headers
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import (
    AuthenticationException,
    RateLimitException,
    SandboxException,
)


def make_logging_event_hooks(log: Optional[logging.Logger]) -> dict:
    """Build synchronous httpx ``event_hooks`` that log requests and responses
    to the given ``logging.Logger``. Requests log at ``INFO``, successful
    responses at ``INFO`` and responses with status >= 400 at ``ERROR``.

    Returns no hooks when ``log`` is ``None`` so that nothing is logged unless a
    logger was explicitly supplied."""
    if log is None:
        return {}

    def on_request(request) -> None:
        log.info(f"Request {request.method} {request.url}")

    def on_response(response: Response) -> None:
        if response.status_code >= 400:
            log.error(f"Response {response.status_code}")
        else:
            log.info(f"Response {response.status_code}")

    return {"request": [on_request], "response": [on_response]}


def make_async_logging_event_hooks(log: Optional[logging.Logger]) -> dict:
    """Asynchronous counterpart of :func:`make_logging_event_hooks`."""
    if log is None:
        return {}

    async def on_request(request) -> None:
        log.info(f"Request {request.method} {request.url}")

    async def on_response(response: Response) -> None:
        if response.status_code >= 400:
            log.error(f"Response {response.status_code}")
        else:
            log.info(f"Response {response.status_code}")

    return {"request": [on_request], "response": [on_response]}


limits = Limits(
    max_keepalive_connections=int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS") or "20"),
    max_connections=int(os.getenv("E2B_MAX_CONNECTIONS") or "2000"),
    keepalive_expiry=int(os.getenv("E2B_KEEPALIVE_EXPIRY") or "300"),
)

connection_retries = int(os.getenv("E2B_CONNECTION_RETRIES") or "3")


def _get_socket_options(
    platform: str,
    tcp_keepidle: Optional[int],
    tcp_keepalive: Optional[int],
) -> tuple[tuple[int, int, int], ...]:
    """Build platform-specific TCP keepalive options for httpcore.

    The 60-second initial-delay tuning uses ``TCP_KEEPIDLE`` where the
    constant is available (Linux and other platforms exposing it) or macOS's
    ``TCP_KEEPALIVE``. Windows CPython also defines ``TCP_KEEPIDLE``, but
    setting it raises ``OSError`` on Windows releases older than 10 1709, so
    Windows only enables ``SO_KEEPALIVE`` and keeps the OS-default probe
    timing. Platforms without either constant likewise fall back to
    enabling keepalive only.
    """
    options = [(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)]
    if platform == "win32":
        return tuple(options)
    if tcp_keepidle is not None:
        options.append((socket.IPPROTO_TCP, tcp_keepidle, 60))
    elif platform == "darwin" and tcp_keepalive is not None:
        options.append((socket.IPPROTO_TCP, tcp_keepalive, 60))
    return tuple(options)


_TCP_KEEPALIVE_SOCKET_OPTIONS = _get_socket_options(
    sys.platform,
    getattr(socket, "TCP_KEEPIDLE", None),
    getattr(socket, "TCP_KEEPALIVE", None),
)


class _TCPKeepaliveNetworkBackend(httpcore.NetworkBackend):
    """Force TCP keepalive options through direct and proxy connections."""

    def __init__(self, backend: httpcore.NetworkBackend):
        self._backend = backend

    def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: Optional[float] = None,
        local_address: Optional[str] = None,
        socket_options: Optional[Iterable[tuple]] = None,
    ) -> httpcore.NetworkStream:
        return self._backend.connect_tcp(
            host,
            port,
            timeout=timeout,
            local_address=local_address,
            socket_options=_TCP_KEEPALIVE_SOCKET_OPTIONS,
        )

    def connect_unix_socket(
        self,
        path: str,
        timeout: Optional[float] = None,
        socket_options: Optional[Iterable[tuple]] = None,
    ) -> httpcore.NetworkStream:
        return self._backend.connect_unix_socket(
            path,
            timeout=timeout,
            socket_options=socket_options,
        )


class _TCPKeepaliveAsyncNetworkBackend(httpcore.AsyncNetworkBackend):
    """Async counterpart of :class:`_TCPKeepaliveNetworkBackend`."""

    def __init__(self, backend: httpcore.AsyncNetworkBackend):
        self._backend = backend

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: Optional[float] = None,
        local_address: Optional[str] = None,
        socket_options: Optional[Iterable[tuple]] = None,
    ) -> httpcore.AsyncNetworkStream:
        return await self._backend.connect_tcp(
            host,
            port,
            timeout=timeout,
            local_address=local_address,
            socket_options=_TCP_KEEPALIVE_SOCKET_OPTIONS,
        )

    async def connect_unix_socket(
        self,
        path: str,
        timeout: Optional[float] = None,
        socket_options: Optional[Iterable[tuple]] = None,
    ) -> httpcore.AsyncNetworkStream:
        return await self._backend.connect_unix_socket(
            path,
            timeout=timeout,
            socket_options=socket_options,
        )

    async def sleep(self, seconds: float) -> None:
        await self._backend.sleep(seconds)


class _TCPKeepaliveHTTPTransport(httpx.HTTPTransport):
    """HTTPX transport that also covers HTTPcore proxy sockets."""

    def __init__(self, *args, **kwargs):
        kwargs["socket_options"] = _TCP_KEEPALIVE_SOCKET_OPTIONS
        super().__init__(*args, **kwargs)
        # NOTE: `_pool` / `_network_backend` are httpx/httpcore private API.
        # HTTPcore 1.0.x drops `socket_options` when it builds proxy
        # connections (HTTPProxy/SOCKSProxy), so wrap the backend to force
        # the keepalive options at actual TCP connect time. Verified against
        # the `httpcore>=1.0.5,<2.0.0` pin in pyproject.toml — re-check on bumps.
        pool = cast(Any, self._pool)
        pool._network_backend = _TCPKeepaliveNetworkBackend(pool._network_backend)


class _TCPKeepaliveAsyncHTTPTransport(httpx.AsyncHTTPTransport):
    """Async HTTPX transport that also covers HTTPcore proxy sockets."""

    def __init__(self, *args, **kwargs):
        kwargs["socket_options"] = _TCP_KEEPALIVE_SOCKET_OPTIONS
        super().__init__(*args, **kwargs)
        # NOTE: `_pool` / `_network_backend` are httpx/httpcore private API —
        # see _TCPKeepaliveHTTPTransport for the rationale and version pins.
        pool = cast(Any, self._pool)
        pool._network_backend = _TCPKeepaliveAsyncNetworkBackend(pool._network_backend)


class _TCPKeepaliveTransport(httpx.BaseTransport, httpx.AsyncBaseTransport):
    """Dual sync/async transport for directly constructed public clients."""

    def __init__(self, **kwargs):
        self._sync_transport = _TCPKeepaliveHTTPTransport(**kwargs)
        self._async_transport = _TCPKeepaliveAsyncHTTPTransport(**kwargs)

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        return self._sync_transport.handle_request(request)

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        return await self._async_transport.handle_async_request(request)

    def close(self) -> None:
        self._sync_transport.close()

    async def aclose(self) -> None:
        await self._async_transport.aclose()


# Any transport type produced by the factory passed to
# _build_env_proxy_mounts; keeps the returned mount dict precisely typed for
# both sync and async httpx clients.
_TransportT = TypeVar("_TransportT", bound=Union[BaseTransport, AsyncBaseTransport])


def _build_env_proxy_mounts(
    transport_factory: Callable[[str], _TransportT],
) -> dict[str, Optional[_TransportT]]:
    """Rebuild httpx's environment-proxy mounts for clients that pass an
    explicit ``transport=``.

    Passing an explicit transport to an httpx client disables its
    ``trust_env`` proxy handling entirely, so ``HTTP_PROXY``/``HTTPS_PROXY``/
    ``ALL_PROXY`` would silently be ignored. This reconstructs the same
    mounts httpx would have built, creating a proxied transport per proxy URL
    via ``transport_factory``. ``NO_PROXY`` entries map to ``None`` mounts,
    which httpx routes to the default (direct) transport.
    """
    return {
        pattern: None if proxy_url is None else transport_factory(proxy_url)
        for pattern, proxy_url in get_environment_proxies().items()
    }


@dataclass
class SandboxCreateResponse:
    sandbox_id: str
    sandbox_domain: Optional[str]
    envd_version: str
    envd_access_token: Optional[str]
    traffic_access_token: Optional[str]


def api_exception_from_code(
    status_code: int,
    message: Optional[str] = None,
    default_exception_class: type[Exception] = SandboxException,
    stack_trace: Optional[TracebackType] = None,
) -> Exception:
    """Map an API error code and message to the matching exception class — the
    same mapping :func:`handle_api_exception` applies to HTTP responses, usable
    for error objects embedded in response bodies (e.g. per-fork results)."""
    if status_code == 401:
        text = f"{status_code}: Unauthorized, please check your credentials."
        if message:
            text += f" - {message}"
        return AuthenticationException(text)

    if status_code == 429:
        text = f"{status_code}: Rate limit exceeded, please try again later."
        if message:
            text += f" - {message}"
        return RateLimitException(text)

    return default_exception_class(f"{status_code}: {message}").with_traceback(
        stack_trace
    )


def handle_api_exception(
    e: "SupportsApiErrorResponse",
    default_exception_class: type[Exception] = SandboxException,
    stack_trace: Optional[TracebackType] = None,
):
    try:
        body = json.loads(e.content) if e.content else {}
    except json.JSONDecodeError:
        body = {}

    message = body["message"] if "message" in body else None
    if message is None and e.status_code not in (401, 429):
        return default_exception_class(f"{e.status_code}: {e.content}").with_traceback(
            stack_trace
        )

    return api_exception_from_code(
        e.status_code, message, default_exception_class, stack_trace
    )


class SupportsApiErrorResponse(Protocol):
    @property
    def status_code(self) -> int: ...

    @property
    def content(self) -> Union[str, bytes]: ...


_API_KEY_PATTERN = re.compile(r"\Ae2b_[0-9a-f]+\Z")
_API_KEY_EXAMPLE = "e2b_" + "0" * 40


def validate_api_key(api_key: str) -> None:
    """Validate that an E2B API key has the expected ``e2b_`` prefix
    followed by hex characters. Raises ``AuthenticationException`` otherwise.
    """
    if not _API_KEY_PATTERN.match(api_key):
        raise AuthenticationException(
            'Invalid API key format: expected "e2b_" followed by hex '
            f'characters (e.g. "{_API_KEY_EXAMPLE}"). '
            "Visit the API Keys tab at https://e2b.dev/dashboard?tab=keys to get your API key."
        )


class ApiClient(AuthenticatedClient):
    """
    The client for interacting with the E2B API.
    """

    def __init__(
        self,
        config: ConnectionConfig,
        transport: Optional[Union[BaseTransport, AsyncBaseTransport]] = None,
        transport_factory: Optional[Callable[[], BaseTransport]] = None,
        async_transport_factory: Optional[Callable[[], AsyncBaseTransport]] = None,
        *args,
        **kwargs,
    ):
        if transport is not None and (
            transport_factory is not None or async_transport_factory is not None
        ):
            raise ValueError("Use either transport or transport_factory, not both")

        self._transport_factory = transport_factory
        self._async_transport_factory = async_transport_factory
        self._thread_local = threading.local()
        # Keyed weakly by the event loop object itself, not id(loop) —
        # CPython reuses object ids, so a new loop could otherwise inherit
        # a client bound to a previous, closed loop.
        self._async_clients: weakref.WeakKeyDictionary[
            asyncio.AbstractEventLoop, httpx.AsyncClient
        ] = weakref.WeakKeyDictionary()
        self._proxy = config.proxy

        if config.api_key is None:
            raise AuthenticationException(
                "API key is required, please visit the API Keys tab at https://e2b.dev/dashboard?tab=keys to get your API key. "
                "You can either set the environment variable `E2B_API_KEY` "
                'or you can pass it directly to the method like api_key="e2b_..."',
            )

        if config.api_key is not None and config.validate_api_key:
            validate_api_key(config.api_key)

        token = config.api_key
        auth_header_name = "X-API-KEY"
        prefix = ""

        self._logger = config.logger

        headers = {
            **default_headers,
            # Deprecated: send the access token alongside the API key when one
            # is available, mirroring the JS SDK. Prefer `api_headers` instead.
            # Spread before `config.headers` so a custom `Authorization` in
            # `api_headers` wins over the deprecated access token, matching JS.
            **(
                {"Authorization": f"Bearer {config.access_token}"}
                if config.access_token is not None
                else {}
            ),
            **(config.headers or {}),
        }

        # Prevent passing these parameters twice
        more_headers: Optional[dict] = kwargs.pop("headers", None)
        if more_headers:
            headers.update(more_headers)
        kwargs.pop("token", None)
        kwargs.pop("auth_header_name", None)
        kwargs.pop("prefix", None)

        httpx_args = {
            "event_hooks": self._logging_event_hooks(),
        }
        if (
            transport is None
            and transport_factory is None
            and async_transport_factory is None
        ):
            transport_options = {"verify": kwargs.get("verify_ssl", True)}
            transport = _TCPKeepaliveTransport(
                proxy=config.proxy,
                **transport_options,
            )
            if config.proxy is None:
                httpx_args["mounts"] = _build_env_proxy_mounts(
                    lambda proxy_url: _TCPKeepaliveTransport(
                        proxy=proxy_url,
                        **transport_options,
                    )
                )
        if transport is not None:
            httpx_args["transport"] = transport

        # config.request_timeout is None when the timeout is explicitly
        # disabled (request_timeout=0), which httpx.Timeout(None) preserves.
        kwargs.setdefault("timeout", Timeout(config.request_timeout))

        super().__init__(
            base_url=config.api_url,
            httpx_args=httpx_args,
            headers=headers,
            token=token or "",
            auth_header_name=auth_header_name,
            prefix=prefix,
            *args,
            **kwargs,
        )

    def _logging_event_hooks(self) -> dict:
        return make_logging_event_hooks(self._logger)

    def _headers_with_auth(self) -> dict:
        return {
            **self._headers,
            self.auth_header_name: (
                f"{self.prefix} {self.token}" if self.prefix else self.token
            ),
        }

    def get_httpx_client(self) -> httpx.Client:
        if self._client is not None or self._transport_factory is None:
            return super().get_httpx_client()

        client = getattr(self._thread_local, "client", None)
        if client is None:
            client = httpx.Client(
                base_url=self._base_url,
                cookies=self._cookies,
                headers=self._headers_with_auth(),
                timeout=self._timeout,
                verify=self._verify_ssl,
                follow_redirects=self._follow_redirects,
                event_hooks=self._httpx_args.get("event_hooks"),
                transport=self._transport_factory(),
            )
            self._thread_local.client = client
        return client

    def get_async_httpx_client(self) -> httpx.AsyncClient:
        if self._async_client is not None or self._async_transport_factory is None:
            return super().get_async_httpx_client()

        loop = asyncio.get_running_loop()
        client = self._async_clients.get(loop)
        if client is None:
            client = httpx.AsyncClient(
                base_url=self._base_url,
                cookies=self._cookies,
                headers=self._headers_with_auth(),
                timeout=self._timeout,
                verify=self._verify_ssl,
                follow_redirects=self._follow_redirects,
                event_hooks=self._httpx_args.get("event_hooks"),
                transport=self._async_transport_factory(),
            )
            self._async_clients[loop] = client
        return client


# We need to override the logging hooks for the async usage
class AsyncApiClient(ApiClient):
    def _logging_event_hooks(self) -> dict:
        return make_async_logging_event_hooks(self._logger)
