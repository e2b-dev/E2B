import asyncio
import os
import weakref
from typing import Dict, Optional

import httpx
from httpx import Limits
from httpx._types import ProxyTypes

from e2b.api import connection_retries, make_async_logging_event_hooks
from e2b.api.metadata import default_headers
from e2b.exceptions import AuthenticationException
from e2b.volume.client.client import AuthenticatedClient as AsyncVolumeApiClient
from e2b.volume.connection_config import VolumeConnectionConfig

limits = Limits(
    max_keepalive_connections=int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS") or "20"),
    max_connections=int(os.getenv("E2B_MAX_CONNECTIONS") or "2000"),
    keepalive_expiry=int(os.getenv("E2B_KEEPALIVE_EXPIRY") or "300"),
)

TransportKey = Optional[ProxyTypes]


def get_api_client(config: VolumeConnectionConfig, **kwargs) -> AsyncVolumeApiClient:
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
            "transport": get_transport(config),
            "event_hooks": make_async_logging_event_hooks(config.logger),
        },
        **kwargs,
    )


class AsyncTransportWithLogger(httpx.AsyncHTTPTransport):
    # Keyed weakly by the event loop object itself, not id(loop) — CPython
    # reuses object ids, so a new loop could otherwise inherit a transport
    # bound to a previous, closed loop.
    _instances: weakref.WeakKeyDictionary[
        asyncio.AbstractEventLoop,
        Dict[TransportKey, "AsyncTransportWithLogger"],
    ] = weakref.WeakKeyDictionary()

    @property
    def pool(self):
        return self._pool


def get_transport(config: VolumeConnectionConfig) -> AsyncTransportWithLogger:
    loop = asyncio.get_running_loop()
    loop_instances = AsyncTransportWithLogger._instances.get(loop)
    if loop_instances is None:
        loop_instances = {}
        AsyncTransportWithLogger._instances[loop] = loop_instances

    key: TransportKey = config.proxy
    transport = loop_instances.get(key)
    if transport is None:
        transport = AsyncTransportWithLogger(
            limits=limits,
            proxy=config.proxy,
            retries=connection_retries,
        )
        loop_instances[key] = transport

    return transport
