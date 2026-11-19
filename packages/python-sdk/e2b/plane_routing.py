"""Send requests straight to the control plane E2B's API proxy names.

The global API proxy answers every request it forwards with
``X-E2B-Alt-Used: api.<control plane domain>``. The SDK reads the header only
from ``api.<domain>`` responses with ``<domain>`` supported, follows it only to
a supported domain (:mod:`e2b.sandbox_domains`), and sends later API requests,
and envd requests of sandboxes the API named no domain for, to that control
plane. Every response that names one can move it; a learned plane is used for
:data:`PLANE_TTL` seconds, so a project that moved is followed even while its
previous plane still answers.

Requests a learned plane refuses (401 for the API, 502 for envd), or that never
connect to it, are sent again through the configured host when their body can
be sent twice.
"""

import threading
import time
from typing import Dict, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

import httpx
from pyqwest import (
    Request,
    Response,
    SyncRequest,
    SyncResponse,
    SyncTransport,
    Transport,
)

from e2b.connection_config import ConnectionConfig
from e2b.sandbox_domains import is_supported_sandbox_domain

ALT_USED_HEADER = "X-E2B-Alt-Used"

PLANE_TTL = 5 * 60.0
"""Seconds a learned control plane is used before requests go through the
proxy again."""

_lock = threading.Lock()
# plane key -> (control plane domain, learned at, on the monotonic clock)
_planes: Dict[str, Tuple[str, float]] = {}


def plane_key(config: ConnectionConfig) -> Optional[str]:
    """The key ``config``'s learned control plane is stored under, or ``None``
    when ``config`` must not be routed: in debug mode, without an API key, with
    an overridden API or sandbox URL, or on an unsupported domain. A control
    plane belongs to an API key's team, and one process can use several keys.
    """
    if (
        config.debug
        or not config.api_key
        or config._sandbox_url
        or not is_supported_sandbox_domain(config.domain)
        or config.api_url != f"https://api.{config.domain}"
    ):
        return None

    return f"{config.domain}\n{config.api_key}"


def _supported_api_domain(host: Optional[str]) -> Optional[str]:
    """``<domain>`` of ``api.<domain>`` when ``<domain>`` is supported."""
    if not host or not host.startswith("api."):
        return None

    domain = host[len("api.") :]
    return domain if is_supported_sandbox_domain(domain) else None


def learn_plane(
    key: str, request_url: str, alt_used: Optional[str], now: Optional[float] = None
) -> None:
    """Learn the control plane ``alt_used`` names, when the response came from
    a supported API host and names a supported one."""
    if not _supported_api_domain(urlsplit(request_url).hostname):
        return

    domain = _supported_api_domain((alt_used or "").strip().lower())
    if domain:
        with _lock:
            _planes[key] = (domain, time.monotonic() if now is None else now)


def current_plane(key: str, now: Optional[float] = None) -> Optional[str]:
    """The control plane learned for ``key``, unless it has expired."""
    now = time.monotonic() if now is None else now
    with _lock:
        plane = _planes.get(key)
    if plane is None or now - plane[1] >= PLANE_TTL:
        return None

    return plane[0]


def forget_plane(key: str, domain: str) -> None:
    """Forget ``domain`` for ``key``, unless a newer response replaced it."""
    with _lock:
        if _planes.get(key, (None,))[0] == domain:
            del _planes[key]


def reset_planes() -> None:
    with _lock:
        _planes.clear()


def move_host(url: str, from_domain: str, to_domain: str) -> Optional[str]:
    """``url`` with its host moved from ``from_domain`` to ``to_domain``:
    ``api.<from>`` to ``api.<to>``, ``sandbox.<from>`` to ``sandbox.<to>``,
    ``<port>-<id>.<from>`` to ``<port>-<id>.<to>``. ``None`` when the host is
    not one label under ``from_domain``."""
    parts = urlsplit(url)
    host = parts.hostname or ""
    suffix = f".{from_domain}"
    label = host[: -len(suffix)] if host.endswith(suffix) else ""
    if not label or "." in label:
        return None

    netloc = f"{label}.{to_domain}"
    if parts.port is not None:
        netloc = f"{netloc}:{parts.port}"
    return urlunsplit(parts._replace(netloc=netloc))


class EnvdPlaneRouting:
    """One sandbox's envd routing. A request whose host is under the configured
    domain goes to the control plane learned for the sandbox's API key. When a
    replayable request the plane answers with 502 or cannot connect for
    succeeds through the configured host, the sandbox stays there for
    :data:`PLANE_TTL` seconds: it is no longer on the learned plane."""

    def __init__(self, key: Optional[str], domain: str):
        self.key = key
        self.domain = domain
        self._configured_until = 0.0

    def target(self, url: str) -> Optional[str]:
        """The URL to send a request for ``url`` to, or ``None`` to send it as
        it is."""
        if self.key is None or time.monotonic() < self._configured_until:
            return None

        plane = current_plane(self.key)
        return move_host(url, self.domain, plane) if plane else None

    def stay_on_configured(self) -> None:
        self._configured_until = time.monotonic() + PLANE_TTL


def envd_plane_routing(config: ConnectionConfig) -> EnvdPlaneRouting:
    """The envd routing of the sandbox ``config`` belongs to, shared by every
    envd client built from it."""
    routing = getattr(config, "_envd_plane_routing", None)
    if routing is None:
        routing = EnvdPlaneRouting(plane_key(config), config.domain)
        config._envd_plane_routing = routing  # type: ignore[attr-defined]
    return routing


# Transports. Each wraps the one below it in the SDK's stack and only acts
# when the config is routed.

_CONNECT_ERRORS = (httpx.ConnectError, httpx.ConnectTimeout)


def _with_url(request: httpx.Request, url: str) -> httpx.Request:
    target = httpx.URL(url)
    headers = request.headers.copy()
    headers["Host"] = target.netloc.decode("ascii")
    return httpx.Request(
        request.method,
        target,
        headers=headers,
        stream=request.stream,
        extensions=request.extensions,
    )


def _replayable_content(content: object) -> bool:
    return content is None or isinstance(content, (bytes, bytearray, memoryview))


class _ApiRouting:
    def __init__(self, config: ConnectionConfig):
        self.key = plane_key(config)
        self.domain = config.domain

    def target(self, request: httpx.Request) -> Optional[Tuple[str, str]]:
        """The control plane and the URL to send ``request`` to, when routed
        and its body can be sent twice."""
        if self.key is None or not isinstance(request.stream, httpx.ByteStream):
            return None
        plane = current_plane(self.key)
        url = move_host(str(request.url), self.domain, plane) if plane else None
        return (plane, url) if plane and url else None

    def learn(self, request: httpx.Request, response: httpx.Response) -> None:
        if self.key is not None:
            learn_plane(
                self.key, str(request.url), response.headers.get(ALT_USED_HEADER)
            )


class PlaneRoutingTransport(httpx.BaseTransport):
    """API requests to the control plane the proxy last named. A request the
    plane refuses with 401, or that never connects to it, is sent again
    through the configured API host, which names the plane that answers now:
    an API key is only accepted by its own plane."""

    def __init__(self, transport: httpx.BaseTransport, config: ConnectionConfig):
        self.transport = transport
        self._routing = _ApiRouting(config)

    def _send(self, request: httpx.Request) -> httpx.Response:
        response = self.transport.handle_request(request)
        self._routing.learn(request, response)
        return response

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        target = self._routing.target(request)
        if target is None:
            return self._send(request)

        plane, url = target
        assert self._routing.key is not None
        try:
            response = self._send(_with_url(request, url))
        except _CONNECT_ERRORS:
            forget_plane(self._routing.key, plane)
            return self._send(request)

        if response.status_code != 401:
            return response

        forget_plane(self._routing.key, plane)
        response.close()
        return self._send(request)

    def close(self) -> None:
        self.transport.close()


class AsyncPlaneRoutingTransport(httpx.AsyncBaseTransport):
    """Async counterpart of :class:`PlaneRoutingTransport`."""

    def __init__(self, transport: httpx.AsyncBaseTransport, config: ConnectionConfig):
        self.transport = transport
        self._routing = _ApiRouting(config)

    async def _send(self, request: httpx.Request) -> httpx.Response:
        response = await self.transport.handle_async_request(request)
        self._routing.learn(request, response)
        return response

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        target = self._routing.target(request)
        if target is None:
            return await self._send(request)

        plane, url = target
        assert self._routing.key is not None
        try:
            response = await self._send(_with_url(request, url))
        except _CONNECT_ERRORS:
            forget_plane(self._routing.key, plane)
            return await self._send(request)

        if response.status_code != 401:
            return response

        forget_plane(self._routing.key, plane)
        await response.aclose()
        return await self._send(request)

    async def aclose(self) -> None:
        await self.transport.aclose()


class EnvdPlaneRoutingTransport(httpx.BaseTransport):
    """A sandbox's envd HTTP API requests to its control plane (see
    :class:`EnvdPlaneRouting`)."""

    def __init__(self, transport: httpx.BaseTransport, routing: EnvdPlaneRouting):
        self.transport = transport
        self._routing = routing

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        url = self._routing.target(str(request.url))
        if url is None:
            return self.transport.handle_request(request)

        routed = _with_url(request, url)
        if not isinstance(request.stream, httpx.ByteStream):
            return self.transport.handle_request(routed)

        try:
            response = self.transport.handle_request(routed)
        except _CONNECT_ERRORS:
            return self._fallback(request)

        if response.status_code != 502:
            return response

        response.close()
        return self._fallback(request)

    def _fallback(self, request: httpx.Request) -> httpx.Response:
        response = self.transport.handle_request(request)
        if response.is_success:
            self._routing.stay_on_configured()
        return response

    def close(self) -> None:
        self.transport.close()


class AsyncEnvdPlaneRoutingTransport(httpx.AsyncBaseTransport):
    """Async counterpart of :class:`EnvdPlaneRoutingTransport`."""

    def __init__(self, transport: httpx.AsyncBaseTransport, routing: EnvdPlaneRouting):
        self.transport = transport
        self._routing = routing

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        url = self._routing.target(str(request.url))
        if url is None:
            return await self.transport.handle_async_request(request)

        routed = _with_url(request, url)
        if not isinstance(request.stream, httpx.ByteStream):
            return await self.transport.handle_async_request(routed)

        try:
            response = await self.transport.handle_async_request(routed)
        except _CONNECT_ERRORS:
            return await self._fallback(request)

        if response.status_code != 502:
            return response

        await response.aclose()
        return await self._fallback(request)

    async def _fallback(self, request: httpx.Request) -> httpx.Response:
        response = await self.transport.handle_async_request(request)
        if response.is_success:
            self._routing.stay_on_configured()
        return response

    async def aclose(self) -> None:
        await self.transport.aclose()


class EnvdPlaneRoutingRpcTransport:
    """A sandbox's envd RPCs to its control plane (see
    :class:`EnvdPlaneRouting`), on the pyqwest transport."""

    def __init__(self, inner: SyncTransport, routing: EnvdPlaneRouting):
        self._inner = inner
        self._routing = routing

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        url = self._routing.target(request.url)
        if url is None:
            return self._inner.execute_sync(request)

        routed = SyncRequest(
            request.method, url, headers=request.headers, content=request.content
        )
        if not _replayable_content(request.content):
            return self._inner.execute_sync(routed)

        try:
            response = self._inner.execute_sync(routed)
        except ConnectionError:
            return self._fallback(request)

        if response.status != 502:
            return response

        response.close()
        return self._fallback(request)

    def _fallback(self, request: SyncRequest) -> SyncResponse:
        response = self._inner.execute_sync(request)
        if 200 <= response.status < 300:
            self._routing.stay_on_configured()
        return response


class AsyncEnvdPlaneRoutingRpcTransport:
    """Async counterpart of :class:`EnvdPlaneRoutingRpcTransport`."""

    def __init__(self, inner: Transport, routing: EnvdPlaneRouting):
        self._inner = inner
        self._routing = routing

    async def execute(self, request: Request) -> Response:
        url = self._routing.target(request.url)
        if url is None:
            return await self._inner.execute(request)

        routed = Request(
            request.method, url, headers=request.headers, content=request.content
        )
        if not _replayable_content(request.content):
            return await self._inner.execute(routed)

        try:
            response = await self._inner.execute(routed)
        except ConnectionError:
            return await self._fallback(request)

        if response.status != 502:
            return response

        await response.aclose()
        return await self._fallback(request)

    async def _fallback(self, request: Request) -> Response:
        response = await self._inner.execute(request)
        if 200 <= response.status < 300:
            self._routing.stay_on_configured()
        return response
