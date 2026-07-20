"""envd RPC client plumbing shared by the sync and async flavors.

The envd RPC clients (process, filesystem) run on `connectrpc`, whose HTTP
layer is `pyqwest` (Rust reqwest/hyper). This is a separate stack from the
`httpx` transports in `e2b.api`, which keep serving the REST API and the
multipart file transfer endpoints. Unlike the previous httpcore-based
transport, hyper sends RST_STREAM when a server stream is closed early, so
abandoned command/watch streams don't leak on the shared HTTP/2 connection.

The flavor-specific transports and client factories live in
:mod:`e2b.envd.client_sync` and :mod:`e2b.envd.client_async`, mirroring the
`e2b.api.client_sync`/`client_async` layout.
"""

import os
from typing import Optional, TypeVar

from protobuf import Message

_MESSAGE = TypeVar("_MESSAGE", bound=Message)


class _ProtoJSONCodec:
    """JSON codec matching the JS SDK's `useBinaryFormat: false`.

    connectrpc's default codec is binary protobuf, which would silently
    change the wire format the SDK has always used; its built-in JSON codec
    fails hard on unknown fields, which would break an older SDK against a
    newer envd that added response fields. This codec is the built-in JSON
    codec plus `ignore_unknown_fields`.
    """

    def name(self) -> str:
        return "json"

    def encode(self, message: Message) -> bytes:
        return message.to_json().encode("utf-8")

    def decode(self, data, message_class: type[_MESSAGE]) -> _MESSAGE:
        return message_class.from_json(data, ignore_unknown_fields=True)


ENVD_JSON_CODEC = _ProtoJSONCodec()

# Mirror the httpx pool tuning in `e2b.api.limits` with pyqwest's equivalents.
# `pool_max_idle_per_host` is per host rather than httpx's global idle cap,
# which suits envd traffic — each sandbox is its own host.
pool_idle_timeout = float(os.getenv("E2B_KEEPALIVE_EXPIRY") or "300")
pool_max_idle_per_host = int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS") or "20")


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
