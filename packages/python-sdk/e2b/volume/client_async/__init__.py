import threading
from typing import Dict, Optional, Tuple

import httpx
from pyqwest import HTTPTransport

from e2b.api import (
    ProxyConfig,
    connection_retries,
    make_async_logging_event_hooks,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_config,
)
from e2b.api.client_async import AsyncApiPyqwestTransport, ConnectionRetryTransport
from e2b.api.metadata import default_headers
from e2b.exceptions import AuthenticationException
from e2b.volume.client.client import AuthenticatedClient as AsyncVolumeApiClient
from e2b.volume.connection_config import READ_TIMEOUT, VolumeConnectionConfig


def get_api_client(config: VolumeConnectionConfig, **kwargs) -> AsyncVolumeApiClient:
    """The client for volume content API calls."""
    return _api_client(config, get_transport(config), **kwargs)


def get_streaming_api_client(
    config: VolumeConnectionConfig, **kwargs
) -> AsyncVolumeApiClient:
    """The client for streamed downloads: the same client on the streaming
    transport, which bounds a stalled read (see :func:`get_streaming_transport`)."""
    return _api_client(config, get_streaming_transport(config), **kwargs)


def _api_client(
    config: VolumeConnectionConfig, transport: AsyncApiPyqwestTransport, **kwargs
) -> AsyncVolumeApiClient:
    if config.access_token is None:
        raise AuthenticationException(
            "Volume token is required for volume content operations. "
            "Use `AsyncVolume.create`/`AsyncVolume.connect` to obtain it "
            "or pass `token` in options.",
        )

    headers = {
        **default_headers,
        **(config.headers or {}),
    }

    request_timeout = config.request_timeout

    return AsyncVolumeApiClient(
        base_url=config.api_url,
        token=config.access_token,
        auth_header_name="Authorization",
        prefix="Bearer",
        headers=headers,
        timeout=(
            httpx.Timeout(request_timeout) if request_timeout is not None else None
        ),
        httpx_args={
            # The proxy lives in the cached transport; passing `proxy` here too
            # would mount a fresh, never-closed proxy transport per client.
            "transport": transport,
            "event_hooks": make_async_logging_event_hooks(config.logger),
        },
        **kwargs,
    )


_transport_lock = threading.Lock()
# One transport (= one connection pool) per proxy and read timeout; None is
# the direct pool. pyqwest's I/O runs on its own Rust runtime, so unlike the
# httpx transport this replaced, the transport is not bound to an event loop
# and the cache is process-global rather than per-loop.
_transports: Dict[
    Tuple[Optional[ProxyConfig], Optional[float]], AsyncApiPyqwestTransport
] = {}


def get_transport(config: VolumeConnectionConfig) -> AsyncApiPyqwestTransport:
    """The shared pyqwest-backed httpx transport for volume content API calls.

    It carries no idle read bound: reqwest's read timer keeps running while a
    request body is sent and while waiting for the response head, so one here
    would cut off uploads and slow unary responses (they stay bounded by
    their whole-request deadlines instead). Streamed downloads, which do need
    an idle bound, use :func:`get_streaming_transport`.
    """
    return _transport(config, read_timeout=None)


def get_streaming_transport(
    config: VolumeConnectionConfig,
) -> AsyncApiPyqwestTransport:
    """The transport for streamed downloads, carrying ``READ_TIMEOUT`` as the
    idle bound on every read: it resets after each successful read, so it caps
    how long a streamed download may stall without limiting total transfer
    time. It is fixed per transport — the adapter's per-request timeouts are
    whole-request deadlines, and the sync adapter does not bound body reads at
    all.
    """
    return _transport(config, read_timeout=READ_TIMEOUT)


def _transport(
    config: VolumeConnectionConfig, *, read_timeout: Optional[float]
) -> AsyncApiPyqwestTransport:
    proxy = proxy_to_config(config.proxy)
    key = (proxy, read_timeout)
    with _transport_lock:
        transport = _transports.get(key)
        if transport is None:
            transport = AsyncApiPyqwestTransport(
                ConnectionRetryTransport(
                    HTTPTransport(
                        tls_include_system_certs=True,
                        proxy=proxy.to_pyqwest() if proxy is not None else None,
                        pool_idle_timeout=pool_idle_timeout,
                        pool_max_idle_per_host=pool_max_idle_per_host,
                        read_timeout=read_timeout,
                    ),
                    max_retries=connection_retries,
                )
            )
            _transports[key] = transport
        return transport
