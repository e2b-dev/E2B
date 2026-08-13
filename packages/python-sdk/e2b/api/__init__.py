import json
import logging
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from types import TracebackType
from typing import Any, Dict, NamedTuple, Optional, Protocol, Tuple, Union

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


connection_retries = int(os.getenv("E2B_CONNECTION_RETRIES") or "3")

# Pool tuning for the pyqwest transports, shared by the REST API, envd RPC,
# and envd HTTP API stacks. `pool_max_idle_per_host` is per host rather than
# the global idle cap the httpx transports took, which suits both: API traffic
# goes to a single host and each sandbox is its own host. `E2B_MAX_CONNECTIONS`
# has no counterpart left — reqwest does not cap concurrent connections — so it
# is no longer read.
pool_idle_timeout = float(os.getenv("E2B_KEEPALIVE_EXPIRY") or "300")
pool_max_idle_per_host = int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS") or "20")


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


_PEM_CERTIFICATE_MARKER = b"-----BEGIN CERTIFICATE-----"


@lru_cache(maxsize=None)
def load_ca_bundle(path: Optional[str]) -> Optional[bytes]:
    """Read the PEM CA bundle the ``ca_bundle`` connection option points at,
    in the ``bytes`` form pyqwest transports take. ``None`` passes through so
    callers don't have to branch.

    The file is read once per path — every transport built for the same
    ``ca_bundle`` reuses the result — and is checked to look like PEM here so a
    bundle that trusts nothing is reported against the option that named it,
    rather than as a certificate error on some later connection. pyqwest 0.9.0
    accepts such a bundle silently; curioswitch/pyqwest#216 makes it raise, and
    even then this check keeps the failure at configuration time.

    :raises InvalidArgumentException: if the file can't be read or holds no PEM
        certificate.
    """
    if path is None:
        return None

    try:
        pem = Path(path).read_bytes()
    except OSError as e:
        raise InvalidArgumentException(
            f"Could not read the CA bundle at {path!r}: {e}. "
            "`ca_bundle` (or the E2B_CA_BUNDLE environment variable) must be "
            "the path of a PEM file holding the CA certificates to trust."
        ) from e

    if _PEM_CERTIFICATE_MARKER not in pem:
        raise InvalidArgumentException(
            f"The CA bundle at {path!r} holds no PEM certificate: expected a "
            f'file containing "{_PEM_CERTIFICATE_MARKER.decode()}". '
            "Convert a DER certificate with "
            "`openssl x509 -inform der -in ca.der -out ca.pem`."
        )

    return pem


def reject_verify_ssl(kwargs: Dict[str, Any]) -> None:
    """Reject the generated clients' ``verify_ssl`` argument, taken out of
    ``kwargs``.

    It configures httpx's own transport, which every SDK client replaces with a
    pyqwest one, so honoring it is impossible and accepting it would silently
    leave TLS trust unconfigured. ``True`` is the generated default and means
    "nothing configured".

    :raises InvalidArgumentException: if ``verify_ssl`` was set to anything else.
    """
    if kwargs.pop("verify_ssl", True) is not True:
        raise InvalidArgumentException(
            "`verify_ssl` is not supported: requests go through pyqwest "
            "transports, which httpx's `verify` does not reach. Pass "
            "`ca_bundle` — the path of a PEM file — to trust a private CA. "
            "Disabling verification and `ssl.SSLContext` have no equivalent."
        )


class SupportsTransportOptions(Protocol):
    """The connection-config attributes that shape a transport: implemented by
    both :class:`e2b.connection_config.ConnectionConfig` and
    :class:`e2b.volume.connection_config.VolumeConnectionConfig`."""

    @property
    def proxy(self) -> Optional[ProxyTypes]: ...

    @property
    def ca_bundle(self) -> Optional[str]: ...


class TransportConfig(NamedTuple):
    """The connection options that shape a pyqwest transport — the proxy it
    sends through and the TLS trust it validates servers against.

    A tuple so it can key the transport caches directly: it is hashable and
    compares by value, so every client configured the same way shares one
    connection pool while a differing one gets its own."""

    proxy: Optional[ProxyConfig] = None
    ca_bundle: Optional[str] = None

    @staticmethod
    def from_config(config: SupportsTransportOptions) -> "TransportConfig":
        """The transport configuration a connection config asks for.

        :raises InvalidArgumentException: if the ``proxy`` or ``ca_bundle``
            option can't be honored by the pyqwest transports.
        """
        transport = TransportConfig(proxy_to_config(config.proxy), config.ca_bundle)
        # Surface an unusable CA bundle where the connection is configured
        # rather than on the first request through the transport.
        load_ca_bundle(transport.ca_bundle)
        return transport

    def transport_kwargs(self) -> Dict[str, Any]:
        """The proxy and TLS-trust arguments every pyqwest transport in the SDK
        is built with.

        The system CA store stays trusted (without it TLS through an
        intercepting proxy fails) when a ``ca_bundle`` is configured: it adds
        trust for a private CA rather than replacing the public ones."""
        return {
            "proxy": self.proxy.to_pyqwest() if self.proxy is not None else None,
            "tls_include_system_certs": True,
            "tls_ca_cert": load_ca_bundle(self.ca_bundle),
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
        # The connection options of the transport this client was built on, so
        # that a request made outside the generated client (the template build
        # context upload) can build a matching one.
        self._transport_config = TransportConfig.from_config(config)

        reject_verify_ssl(kwargs)

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
        return make_logging_event_hooks(self._logger)


# We need to override the logging hooks for the async usage
class AsyncApiClient(ApiClient):
    def _logging_event_hooks(self) -> dict:
        return make_async_logging_event_hooks(self._logger)
