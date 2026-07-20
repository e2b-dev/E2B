"""connectrpc client construction for envd RPC calls.

Wires the generated connectrpc clients (process, filesystem) with the shared
pyqwest transports from :mod:`e2b.envd.transport`, the envd JSON codec, and
the SDK's default-header/retry/logging interceptors from
:mod:`e2b.envd.interceptors`.
"""

from typing import (
    Any,
    AsyncGenerator,
    AsyncIterator,
    Callable,
    Generator,
    Iterator,
    TypeVar,
    cast,
)

from protobuf import Message
from pyqwest import Client, SyncClient

from e2b.connection_config import ConnectionConfig
from e2b.envd.interceptors import build_interceptors
from e2b.envd.transport import get_async_transport, get_sync_transport, proxy_to_url

RES = TypeVar("RES")

_MESSAGE = TypeVar("_MESSAGE", bound=Message)


class _ProtoJSONCodec:
    """JSON codec matching the JS SDK's `useBinaryFormat: false`.

    Unknown response fields are ignored so an older SDK keeps working against
    a newer envd that added fields (the default codec shipped with connectrpc
    fails hard on unknown fields).
    """

    def name(self) -> str:
        return "json"

    def encode(self, message: Message) -> bytes:
        return message.to_json().encode("utf-8")

    def decode(self, data, message_class: type[_MESSAGE]) -> _MESSAGE:
        return message_class.from_json(data, ignore_unknown_fields=True)


ENVD_JSON_CODEC = _ProtoJSONCodec()


def as_stream(events: Iterator[RES]) -> Generator[RES, Any, None]:
    """The generated stubs type server streams as ``Iterator``, but connectrpc
    returns real generators — the SDK relies on ``close()`` to cancel a stream
    early (hyper then resets the HTTP/2 stream)."""
    return cast("Generator[RES, Any, None]", events)


def as_async_stream(events: AsyncIterator[RES]) -> AsyncGenerator[RES, Any]:
    """Async variant of :func:`as_stream`; the SDK relies on ``aclose()``."""
    return cast("AsyncGenerator[RES, Any]", events)


TClient = TypeVar("TClient")

# Compression is disabled in both directions to match the previous transport;
# envd's handling of compressed streaming bodies is unresolved.


def create_rpc_client(
    client_cls: Callable[..., TClient],
    base_url: str,
    config: ConnectionConfig,
) -> TClient:
    """Build a generated sync connectrpc client (e.g. ``ProcessClientSync``)."""
    http_client = SyncClient(get_sync_transport(proxy_to_url(config.proxy)))
    return client_cls(
        base_url,
        codec=ENVD_JSON_CODEC,
        send_compression=None,
        accept_compression=(),
        interceptors=build_interceptors(config, base_url),
        http_client=http_client,
    )


def create_async_rpc_client(
    client_cls: Callable[..., TClient],
    base_url: str,
    config: ConnectionConfig,
) -> TClient:
    """Build a generated async connectrpc client (e.g. ``ProcessClient``)."""
    http_client = Client(get_async_transport(proxy_to_url(config.proxy)))
    return client_cls(
        base_url,
        codec=ENVD_JSON_CODEC,
        send_compression=None,
        accept_compression=(),
        interceptors=build_interceptors(config, base_url),
        http_client=http_client,
    )
