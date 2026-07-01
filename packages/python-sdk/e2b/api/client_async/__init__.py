import asyncio
import weakref
from typing import Dict, Optional, Tuple

import httpx

from httpx._types import ProxyTypes

from e2b.api import AsyncApiClient, connection_retries, limits, request_retries, RETRYABLE_STATUS_CODES, _retry_logger
from e2b.connection_config import ConnectionConfig

TransportKey = Tuple[bool, Optional[ProxyTypes]]


def get_api_client(config: ConnectionConfig, **kwargs) -> AsyncApiClient:
    return AsyncApiClient(
        config,
        async_transport_factory=lambda: get_transport(config),
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

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        last_exc: Optional[Exception] = None
        for attempt in range(1 + request_retries):
            try:
                response = await super().handle_async_request(request)
                if response.status_code in RETRYABLE_STATUS_CODES and attempt < request_retries:
                    await response.aread()
                    await response.aclose()
                    delay = min(2 ** attempt, 8)
                    _retry_logger.warning(
                        "Retrying %s %s (attempt %d/%d, backoff %ds): server returned %d",
                        request.method, request.url, attempt + 1, request_retries, delay,
                        response.status_code,
                    )
                    await asyncio.sleep(delay)
                    continue
                return response
            except httpx.TimeoutException:
                raise
            except Exception as exc:
                last_exc = exc
                if attempt < request_retries:
                    delay = min(2 ** attempt, 8)
                    _retry_logger.warning(
                        "Retrying %s %s (attempt %d/%d, backoff %ds): %s",
                        request.method, request.url, attempt + 1, request_retries, delay,
                        exc,
                    )
                    await asyncio.sleep(delay)
                    continue
                raise
        raise last_exc  # type: ignore[misc]


def _get_cached_transport(cls, config: ConnectionConfig, http2: bool):
    loop = asyncio.get_running_loop()
    loop_instances = cls._instances.get(loop)
    if loop_instances is None:
        loop_instances = {}
        cls._instances[loop] = loop_instances

    key: TransportKey = (http2, config.proxy)
    transport = loop_instances.get(key)
    if transport is None:
        transport = cls(
            limits=limits,
            proxy=config.proxy,
            http2=http2,
            retries=connection_retries,
        )
        loop_instances[key] = transport

    return transport


def get_transport(
    config: ConnectionConfig, http2: bool = True
) -> AsyncTransportWithLogger:
    return _get_cached_transport(AsyncTransportWithLogger, config, http2)


class AsyncEnvdTransportWithLogger(AsyncTransportWithLogger):
    _instances: weakref.WeakKeyDictionary[
        asyncio.AbstractEventLoop,
        Dict[TransportKey, "AsyncEnvdTransportWithLogger"],
    ] = weakref.WeakKeyDictionary()


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> AsyncEnvdTransportWithLogger:
    return _get_cached_transport(AsyncEnvdTransportWithLogger, config, http2)
