from typing import Dict, Optional, Tuple

import time
import httpx
import threading

from httpx._types import ProxyTypes

from e2b.api import ApiClient, connection_retries, limits, request_retries, RETRYABLE_STATUS_CODES, _retry_logger
from e2b.connection_config import ConnectionConfig

TransportKey = Tuple[bool, Optional[ProxyTypes]]


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(
        config,
        transport_factory=lambda: get_transport(config),
        **kwargs,
    )


class TransportWithLogger(httpx.HTTPTransport):
    _thread_local = threading.local()

    @property
    def pool(self):
        return self._pool

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        last_exc: Optional[Exception] = None
        for attempt in range(1 + request_retries):
            try:
                response = super().handle_request(request)
                if response.status_code in RETRYABLE_STATUS_CODES and attempt < request_retries:
                    # Read and close the response before retrying
                    response.read()
                    response.close()
                    delay = min(2 ** attempt, 8)
                    _retry_logger.warning(
                        "Retrying %s %s (attempt %d/%d, backoff %ds): server returned %d",
                        request.method, request.url, attempt + 1, request_retries, delay,
                        response.status_code,
                    )
                    time.sleep(delay)
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
                    time.sleep(delay)
                    continue
                raise
        raise last_exc  # type: ignore[misc]


def get_transport(config: ConnectionConfig, http2: bool = True) -> TransportWithLogger:
    instances: Dict[TransportKey, TransportWithLogger] = getattr(
        TransportWithLogger._thread_local, "instances", {}
    )
    key: TransportKey = (http2, config.proxy)
    cached = instances.get(key)
    if cached is not None:
        return cached

    transport = TransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
        retries=connection_retries,
    )
    instances[key] = transport
    TransportWithLogger._thread_local.instances = instances
    return transport


class EnvdTransportWithLogger(TransportWithLogger):
    _thread_local = threading.local()


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> EnvdTransportWithLogger:
    instances: Dict[TransportKey, EnvdTransportWithLogger] = getattr(
        EnvdTransportWithLogger._thread_local, "instances", {}
    )
    key: TransportKey = (http2, config.proxy)
    cached = instances.get(key)
    if cached is not None:
        return cached

    transport = EnvdTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
        retries=connection_retries,
    )
    instances[key] = transport
    EnvdTransportWithLogger._thread_local.instances = instances
    return transport
