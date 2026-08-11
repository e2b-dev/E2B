import httpx
from pyqwest.httpx import PyqwestTransport

from e2b.api import (
    make_logging_event_hooks,
    proxy_to_config,
)
from e2b.api.client_sync import get_httpx_transport
from e2b.api.client_sync import get_upload_transport as get_upload_httpx_transport
from e2b.api.metadata import default_headers
from e2b.exceptions import AuthenticationException
from e2b.volume.client.client import AuthenticatedClient as VolumeApiClient
from e2b.volume.connection_config import READ_TIMEOUT, VolumeConnectionConfig


def get_api_client(config: VolumeConnectionConfig, **kwargs) -> VolumeApiClient:
    """The client for volume content API calls."""
    return _api_client(config, get_transport(config), **kwargs)


def get_streaming_api_client(
    config: VolumeConnectionConfig, **kwargs
) -> VolumeApiClient:
    """The client for streamed downloads: the same client on the streaming
    transport, which bounds a stalled read (see :func:`get_streaming_transport`)."""
    return _api_client(config, get_streaming_transport(config), **kwargs)


def get_upload_api_client(config: VolumeConnectionConfig, **kwargs) -> VolumeApiClient:
    """The client for uploads: the same client on the upload transport, which
    leaves the connect retries out so that a streamed body isn't copied into
    memory to keep it replayable (see :func:`get_upload_transport`)."""
    return _api_client(config, get_upload_transport(config), **kwargs)


def _api_client(
    config: VolumeConnectionConfig, transport: PyqwestTransport, **kwargs
) -> VolumeApiClient:
    if config.access_token is None:
        raise AuthenticationException(
            "Volume token is required for volume content operations. "
            "Use `Volume.create`/`Volume.connect` to obtain it "
            "or pass `token` in options.",
        )

    headers = {
        **default_headers,
        **(config.headers or {}),
    }

    request_timeout = config.request_timeout

    return VolumeApiClient(
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
            "event_hooks": make_logging_event_hooks(config.logger),
        },
        **kwargs,
    )


def get_transport(config: VolumeConnectionConfig) -> PyqwestTransport:
    """The shared pyqwest-backed httpx transport for volume content API calls —
    the same pool the control-plane REST API and the envd HTTP API draw from
    (see :func:`e2b.api.client_sync.get_pyqwest_transport`); reqwest pools per
    host, so the volume host gets its own connections within it.

    It carries no idle read bound: reqwest's read timer keeps running while a
    request body is sent and while waiting for the response head, so one here
    would cut off uploads and slow unary responses (they stay bounded by
    their whole-request deadlines instead). Streamed downloads, which do need
    an idle bound, use :func:`get_streaming_transport`.
    """
    return get_httpx_transport(proxy_to_config(config.proxy))


def get_upload_transport(config: VolumeConnectionConfig) -> PyqwestTransport:
    """The transport for uploads: the same pool as :func:`get_transport` minus
    the connect retries. The retry layer makes a request body replayable by
    copying it in full as it is sent, so a streamed `write_file` on it would be
    mirrored in memory (see :func:`e2b.api.client_sync.get_upload_transport`).
    """
    return get_upload_httpx_transport(proxy_to_config(config.proxy))


def get_streaming_transport(config: VolumeConnectionConfig) -> PyqwestTransport:
    """The transport for streamed downloads, carrying ``READ_TIMEOUT`` as the
    idle bound on every read: it resets after each successful read, so it caps
    how long a streamed download may stall without limiting total transfer
    time. It is fixed per pool — the adapter's per-request timeouts are
    whole-request deadlines rather than idle bounds — so streamed downloads get
    their own, shared with the sandbox filesystem's streaming transport
    whenever the two bounds agree.
    """
    return get_httpx_transport(proxy_to_config(config.proxy), READ_TIMEOUT)
