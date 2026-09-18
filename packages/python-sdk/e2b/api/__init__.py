import json
import logging
import os
import threading
from dataclasses import dataclass
from types import TracebackType
from typing import List, NamedTuple, Optional, Protocol, Tuple, Union
from urllib.parse import quote

import httpx
from httpx import AsyncBaseTransport, BaseTransport, Timeout
from pyqwest import Proxy

from e2b.api.client.client import AuthenticatedClient
from e2b.api.client.types import Response
from e2b.api.metadata import default_headers
from e2b.connection_config import ConnectionConfig, ProxyTypes
from e2b.exceptions import (
    AuthenticationException,
    InvalidArgumentException,
    RateLimitException,
    ServiceBusyException,
    SandboxException,
)


def encode_path_param(value: str) -> str:
    """
    Percent-encode a template ID, name, or alias for use as one URL path segment.

    Endpoints that take a template ID also accept a name, which may be
    namespaced (``namespace/name``) and carry a ``:tag``. Escaping those
    separators keeps the value inside a single segment instead of splitting the
    route, matching the JS SDK's ``encodeURIComponent``.
    """
    return quote(value, safe="")


def make_logging_event_hooks(
    log: Optional[logging.Logger], include_diagnostics: bool = False
) -> dict:
    """Build synchronous httpx ``event_hooks`` that log requests and responses
    to the given ``logging.Logger``. Requests log at ``INFO``, successful
    responses at ``INFO`` and responses with status >= 400 at ``ERROR``.

    Returns no hooks when ``log`` is ``None`` unless CI diagnostics are enabled;
    that mode logs failed responses only."""
    if log is None and not include_diagnostics:
        return {}

    response_log = log or logging.getLogger("e2b.ci")

    def on_request(request) -> None:
        if log is not None:
            log.info(f"Request {request.method} {request.url}")

    def on_response(response: Response) -> None:
        if response.status_code >= 400:
            trace_id = (
                response.headers.get("X-E2B-Trace-ID") if include_diagnostics else None
            )
            trace_suffix = f" trace_id={trace_id}" if trace_id else ""
            response_log.error(f"Response {response.status_code}{trace_suffix}")
        elif log is not None:
            log.info(f"Response {response.status_code}")

    return {"request": [on_request], "response": [on_response]}


def make_async_logging_event_hooks(
    log: Optional[logging.Logger], include_diagnostics: bool = False
) -> dict:
    """Asynchronous counterpart of :func:`make_logging_event_hooks`."""
    if log is None and not include_diagnostics:
        return {}

    response_log = log or logging.getLogger("e2b.ci")

    async def on_request(request) -> None:
        if log is not None:
            log.info(f"Request {request.method} {request.url}")

    async def on_response(response: Response) -> None:
        if response.status_code >= 400:
            trace_id = (
                response.headers.get("X-E2B-Trace-ID") if include_diagnostics else None
            )
            trace_suffix = f" trace_id={trace_id}" if trace_id else ""
            response_log.error(f"Response {response.status_code}{trace_suffix}")
        elif log is not None:
            log.info(f"Response {response.status_code}")

    return {"request": [on_request], "response": [on_response]}


connection_retries = int(os.getenv("E2B_CONNECTION_RETRIES") or "3")

# Pool tuning for the pyqwest transports, shared by the REST API, envd RPC,
# and envd HTTP API stacks. `pool_max_idle_per_host` is per host rather than
# the global idle cap the httpx transports took, which suits both: API traffic
# goes to a single host and each sandbox is its own host. `E2B_MAX_CONNECTIONS`
# has no counterpart left — reqwest does not cap concurrent connections — so it
# is no longer read.
pool_idle_timeout = float(os.getenv("E2B_KEEPALIVE_EXPIRY") or "300")
pool_max_idle_per_host = int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS") or "20")
# Envd (sandbox) traffic is spread over connection pools opened on demand, see
# `EnvdPoolBalancer`: at most `envd_pool_shards` pools, a further one opened
# once every open pool carries `envd_pool_streams` streams. The stream bound
# sits below the 100 concurrent streams the sandbox host advertises per HTTP/2
# connection, so a pool is left before the peer limit starts queueing.
envd_pool_shards = max(1, int(os.getenv("E2B_ENVD_POOL_SHARDS") or "16"))
envd_pool_streams = max(1, int(os.getenv("E2B_ENVD_POOL_STREAMS") or "90"))


class EnvdPoolBalancer:
    """Least-loaded selection among a bounded set of envd connection pools.

    Production envd requests share one origin, whose HTTP/2 connection has a
    finite concurrent-stream limit. Long-running commands hold their streams
    for their whole lifetime, so a saturated connection queues every further
    request — a readiness check as much as the next command — behind them,
    while the edge and account could serve far more. Spreading sandboxes over
    a fixed number of connections by hashing only moves the ceiling, and opens
    every connection even for a process running a single sandbox.

    Each request is sent on the pool with the fewest requests in flight. A new
    pool is opened only when every open pool already carries
    ``streams_per_pool`` requests, up to ``max_pools``; past that the
    least-loaded pool takes the request regardless. Ties go to the lowest
    index, so load concentrates on the first pools and later ones fall idle
    and expire once a burst is over.

    A request is in flight from the moment it is sent until its response body
    has been fully read or closed. Streamed responses (a running command's
    output) are therefore counted for their whole lifetime, unary ones only
    briefly. Thread-safe: the sync stack shares one balancer across threads.
    """

    def __init__(self, max_pools: int, streams_per_pool: int):
        self._max_pools = max(1, max_pools)
        self._streams_per_pool = max(1, streams_per_pool)
        self._active: List[int] = []
        self._lock = threading.Lock()

    @property
    def active_streams(self) -> Tuple[int, ...]:
        """Requests in flight per open pool, by pool index."""
        with self._lock:
            return tuple(self._active)

    def acquire(self) -> int:
        """Pick the pool for a new request and count it in flight there. The
        caller must pair it with exactly one :meth:`release` of the index."""
        with self._lock:
            if self._active:
                index = min(range(len(self._active)), key=self._active.__getitem__)
                if (
                    self._active[index] < self._streams_per_pool
                    or len(self._active) >= self._max_pools
                ):
                    self._active[index] += 1
                    return index
            self._active.append(1)
            return len(self._active) - 1

    def release(self, index: int) -> None:
        with self._lock:
            self._active[index] -= 1


def envd_pool_balancer(http2: bool) -> EnvdPoolBalancer:
    """The balancer for one set of envd pools, sized from the environment.
    HTTP/1.1 has no per-connection stream limit to spread over — the pool
    opens a connection per concurrent request — so it gets a single pool."""
    return EnvdPoolBalancer(
        envd_pool_shards if http2 else 1,
        envd_pool_streams,
    )


class ProxyConfig(NamedTuple):
    """The ``proxy`` connection option in the shape pyqwest transports take.

    A tuple so it can key the transport caches directly: it is hashable and
    compares by value, where a ``pyqwest.Proxy`` compares by identity and
    would hand every call its own connection pool."""

    url: str
    auth: Optional[Tuple[str, str]] = None
    headers: Tuple[Tuple[str, str], ...] = ()

    def to_pyqwest(self) -> Proxy:
        """The ``pyqwest.Proxy`` to hand a transport."""
        return Proxy(self.url, auth=self.auth, headers=self.headers or None)


def proxy_to_config(proxy: Optional[ProxyTypes]) -> Optional[ProxyConfig]:
    """Convert the ``proxy`` connection option — a URL string, an
    ``httpx.URL``, or an ``httpx.Proxy`` — to the proxy configuration pyqwest
    transports take: a proxy URL (scheme http, https, socks5, or socks5h,
    credentials allowed in the userinfo), basic-auth credentials, and headers
    to send to the proxy. An ``httpx.Proxy`` ``ssl_context`` has no pyqwest
    counterpart and is rejected rather than silently dropped."""
    if proxy is None:
        return None
    if isinstance(proxy, str):
        return ProxyConfig(proxy)
    if isinstance(proxy, httpx.URL):
        return ProxyConfig(str(proxy))
    if isinstance(proxy, httpx.Proxy):
        if proxy.ssl_context is not None:
            raise InvalidArgumentException("httpx.Proxy ssl_context is not supported")
        # httpx.Proxy splits userinfo out of the URL into `.auth`; pyqwest
        # takes the credentials the same way, so they pass straight through.
        return ProxyConfig(
            str(proxy.url),
            auth=proxy.auth,
            headers=tuple(proxy.headers.items()),
        )
    raise InvalidArgumentException(
        "Only URL-string, httpx.URL, and httpx.Proxy proxies are supported, "
        'e.g. proxy="http://user:pass@localhost:8030"'
    )


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

    if status_code == 503:
        text = f"{status_code}: Service temporarily unavailable, please retry."
        if message:
            text += f" - {message}"
        return ServiceBusyException(text)

    err = default_exception_class(f"{status_code}: {message}").with_traceback(
        stack_trace
    )
    if isinstance(err, SandboxException):
        err.status_code = status_code

    return err


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
    if message is None and e.status_code not in (401, 429, 503):
        err = default_exception_class(f"{e.status_code}: {e.content}").with_traceback(
            stack_trace
        )
        if isinstance(err, SandboxException):
            err.status_code = e.status_code

        return err

    return api_exception_from_code(
        e.status_code,
        message,
        default_exception_class,
        stack_trace,
    )


class SupportsApiErrorResponse(Protocol):
    @property
    def status_code(self) -> int: ...

    @property
    def content(self) -> Union[str, bytes]: ...


class ApiClient(AuthenticatedClient):
    """
    The client for interacting with the E2B API.

    A single lazily-created httpx client (see the generated
    ``AuthenticatedClient``) serves all threads and event loops: the pyqwest
    transports it delegates to are thread-safe and loop-independent, and
    ``httpx.Client`` is documented thread-safe.
    """

    def __init__(
        self,
        config: ConnectionConfig,
        transport: Optional[Union[BaseTransport, AsyncBaseTransport]] = None,
        *args,
        **kwargs,
    ):
        self._proxy = config.proxy

        if config.api_key is None:
            raise AuthenticationException(
                "API key is required, please visit the API Keys tab at https://e2b.dev/dashboard?tab=keys to get your API key. "
                "You can either set the environment variable `E2B_API_KEY` "
                'or you can pass it directly to the method like api_key="e2b_..."',
            )

        token = config.api_key
        auth_header_name = "X-API-KEY"
        prefix = ""

        self._logger = config.logger
        self._include_diagnostics = config.request_source == "ci"

        headers = {
            **default_headers,
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
        if transport is not None:
            # The proxy lives in the transport; passing `proxy` here too
            # would mount a fresh, never-closed proxy transport per client.
            httpx_args["transport"] = transport
        else:
            httpx_args["proxy"] = config.proxy

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
        return make_logging_event_hooks(
            self._logger, include_diagnostics=self._include_diagnostics
        )


# We need to override the logging hooks for the async usage
class AsyncApiClient(ApiClient):
    def _logging_event_hooks(self) -> dict:
        return make_async_logging_event_hooks(
            self._logger, include_diagnostics=self._include_diagnostics
        )
