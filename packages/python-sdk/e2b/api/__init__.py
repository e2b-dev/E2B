import json
import logging
import os
import threading
from dataclasses import dataclass
from types import TracebackType
from typing import (
    Callable,
    Dict,
    Generic,
    List,
    NamedTuple,
    Optional,
    Protocol,
    Tuple,
    TypeVar,
    Union,
)
from urllib.parse import quote, urlsplit

import httpx
from httpx import AsyncBaseTransport, BaseTransport, Timeout
from pyqwest import Proxy, StreamError, StreamErrorCode

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
# goes to a single host and each sandbox is its own host.
pool_idle_timeout = float(os.getenv("E2B_KEEPALIVE_EXPIRY") or "300")
pool_max_idle_per_host = int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS") or "20")

# A reqwest pool multiplexes every request to an origin over one HTTP/2
# connection and queues past the server's concurrent-stream limit (envd's
# edge, which all sandboxes share, advertises 100) rather than dialing another
# — long-running commands hold those streams. So each cached transport is a
# set of reqwest pools that grows on demand, like undici's
# `Agent({ connections })` in the JS SDK: a request goes to the pool with the
# fewest in flight to its origin, another pool is dialed once every one
# carries `streams_per_connection` to that origin, up to `max_connections`
# pools.
streams_per_connection = max(1, int(os.getenv("E2B_STREAMS_PER_CONNECTION") or "100"))
max_connections = max(1, int(os.getenv("E2B_MAX_CONNECTIONS") or "200"))

# Request content mirrored for a replay after a refused stream (see
# `is_refused_stream`); a streamed body larger than this is not replayed.
replay_buffer_limit = 64 * 1024

T = TypeVar("T")


def is_refused_stream(e: BaseException) -> bool:
    """Whether the server refused the request's HTTP/2 stream before
    processing it, so sending it again cannot repeat it: an ``RST_STREAM``
    with ``REFUSED_STREAM``, or a stream above the last one a graceful
    ``GOAWAY`` accepted — a connection the server is retiring (e.g. on reaching
    its maximum age) — which pyqwest reports with the same code."""
    return isinstance(e, StreamError) and e.code == StreamErrorCode.REFUSED_STREAM


def request_origin(url: str) -> str:
    """The origin a request URL is served from — what a reqwest pool keeps
    one HTTP/2 connection, and so one concurrent-stream budget, for."""
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}".lower()


class PooledConnection(Generic[T]):
    """One reqwest pool in a :class:`ConnectionBalancer` and the number of
    requests in flight on it, per origin: the pool keeps a connection per
    origin, so the streams of one never crowd out another's."""

    __slots__ = ("transport", "active")

    def __init__(self, transport: T) -> None:
        self.transport = transport
        self.active: Dict[str, int] = {}

    def in_flight(self, origin: str) -> int:
        return self.active.get(origin, 0)


class ConnectionBalancer(Generic[T]):
    """Least-loaded selection over a growable, bounded set of reqwest pools.

    The policy shared by the sync and async balancing transports, which do the
    I/O: :meth:`acquire` picks (or dials) a pool and counts the request on it,
    :meth:`release` uncounts it once the response is consumed or closed.
    Per-request state is a lock away from every thread and loop that shares
    the transport; the lock is reentrant because a release can run from a
    ``__del__`` at any point, including inside :meth:`acquire`."""

    def __init__(self, build: Callable[[], T]) -> None:
        self._build = build
        self._lock = threading.RLock()
        self.connections: List[PooledConnection[T]] = [PooledConnection(build())]

    def acquire(self, origin: str) -> PooledConnection[T]:
        with self._lock:
            connection = min(self.connections, key=lambda c: c.in_flight(origin))
            if (
                connection.in_flight(origin) >= streams_per_connection
                and len(self.connections) < max_connections
            ):
                connection = PooledConnection(self._build())
                self.connections.append(connection)
            connection.active[origin] = connection.in_flight(origin) + 1
            return connection

    def release(self, connection: PooledConnection[T], origin: str) -> None:
        with self._lock:
            remaining = connection.in_flight(origin) - 1
            if remaining:
                connection.active[origin] = remaining
            else:
                del connection.active[origin]


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
