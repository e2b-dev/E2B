import threading
from typing import Dict, Optional

import httpx
from pyqwest import HTTPTransport

from e2b.api import (
    connection_retries,
    make_async_logging_event_hooks,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_url,
)
from e2b.api.client_async import AsyncApiPyqwestTransport, ConnectionRetryTransport
from e2b.api.metadata import default_headers
from e2b.exceptions import AuthenticationException
from e2b.volume.client.client import AuthenticatedClient as AsyncVolumeApiClient
from e2b.volume.connection_config import READ_TIMEOUT, VolumeConnectionConfig


def get_api_client(
    config: VolumeConnectionConfig, *, for_streaming: bool = False, **kwargs
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
            "transport": get_transport(config, for_streaming=for_streaming),
            "event_hooks": make_async_logging_event_hooks(config.logger),
        },
        **kwargs,
    )


_transport_lock = threading.Lock()
# One transport (= one connection pool) per (proxy, streaming) pair; None is
# the direct pool. pyqwest's I/O runs on its own Rust runtime, so unlike the
# httpx transport this replaced, the transport is not bound to an event loop
# and the cache is process-global rather than per-loop.
_transports: Dict[tuple[Optional[str], bool], AsyncApiPyqwestTransport] = {}


def get_transport(
    config: VolumeConnectionConfig, *, for_streaming: bool = False
) -> AsyncApiPyqwestTransport:
    """The shared pyqwest-backed httpx transports for volume content API calls.

    The streaming transport carries ``read_timeout``, the idle bound on every
    read: it resets after each successful read, so it caps how long a
    streamed download may stall without limiting total transfer time. It is
    fixed per transport — the adapter's per-request timeouts are
    whole-request deadlines, and the sync adapter does not bound body reads
    at all. Only streamed downloads use it: reqwest's read timer keeps
    running while a request body is sent and while waiting for the response
    head, so on the regular transport it would cut off uploads and slow
    unary responses longer than the idle bound (those stay bounded by their
    whole-request deadlines instead).
    """
    proxy_url = proxy_to_url(config.proxy)
    key = (proxy_url, for_streaming)
    with _transport_lock:
        transport = _transports.get(key)
        if transport is None:
            transport = AsyncApiPyqwestTransport(
                ConnectionRetryTransport(
                    HTTPTransport(
                        tls_include_system_certs=True,
                        proxy=proxy_url,
                        pool_idle_timeout=pool_idle_timeout,
                        pool_max_idle_per_host=pool_max_idle_per_host,
                        read_timeout=READ_TIMEOUT if for_streaming else None,
                    ),
                    max_retries=connection_retries,
                )
            )
            _transports[key] = transport
        return transport
