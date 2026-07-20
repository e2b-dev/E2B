"""Shared pyqwest HTTP transports for envd RPC calls.

The envd RPC clients (process, filesystem) run on `connectrpc`, whose HTTP
layer is `pyqwest` (Rust reqwest/hyper). This is a separate stack from the
`httpx` transports in `e2b.api`, which keep serving the REST API and the
multipart file transfer endpoints. Unlike the previous httpcore-based
transport, hyper sends RST_STREAM when a server stream is closed early, so
abandoned command/watch streams don't leak on the shared HTTP/2 connection.
"""

import os
import threading
from typing import Optional

from pyqwest import HTTPTransport, SyncHTTPTransport

# Mirror the httpx pool tuning in `e2b.api.limits` with pyqwest's equivalents.
# `pool_max_idle_per_host` is per host rather than httpx's global idle cap,
# which suits envd traffic — each sandbox is its own host.
_pool_idle_timeout = float(os.getenv("E2B_KEEPALIVE_EXPIRY") or "300")
_pool_max_idle_per_host = int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS") or "20")

_transport_lock = threading.Lock()
# One transport (= one connection pool) per proxy; None is the direct pool.
_sync_transports: dict[Optional[str], SyncHTTPTransport] = {}
_async_transports: dict[Optional[str], HTTPTransport] = {}


def proxy_to_url(proxy: object) -> Optional[str]:
    """Narrow the ``proxy`` connection option to the proxy URL string pyqwest
    transports take (scheme http, https, socks5, or socks5h, credentials in
    the URL userinfo). The richer httpx proxy objects the REST client accepts
    are rejected rather than partially honored.
    """
    if proxy is None:
        return None
    if isinstance(proxy, str):
        return proxy
    raise ValueError(
        "Sandbox RPC calls support only URL-string proxies, "
        'e.g. proxy="http://user:pass@localhost:8030"'
    )


def get_sync_transport(proxy_url: Optional[str]) -> SyncHTTPTransport:
    with _transport_lock:
        transport = _sync_transports.get(proxy_url)
        if transport is None:
            transport = SyncHTTPTransport(
                tls_include_system_certs=True,
                proxy=proxy_url,
                pool_idle_timeout=_pool_idle_timeout,
                pool_max_idle_per_host=_pool_max_idle_per_host,
            )
            _sync_transports[proxy_url] = transport
        return transport


def get_async_transport(proxy_url: Optional[str]) -> HTTPTransport:
    with _transport_lock:
        transport = _async_transports.get(proxy_url)
        if transport is None:
            transport = HTTPTransport(
                tls_include_system_certs=True,
                proxy=proxy_url,
                pool_idle_timeout=_pool_idle_timeout,
                pool_max_idle_per_host=_pool_max_idle_per_host,
            )
            _async_transports[proxy_url] = transport
        return transport
