from urllib.parse import quote

import httpx

from e2b import AsyncSandbox, Sandbox, SandboxQuery
from e2b.api.client.client import AuthenticatedClient
from e2b.sandbox_async import paginator as async_paginator
from e2b.sandbox_sync import paginator as sync_paginator


def _expected_metadata_query() -> str:
    safe = "!~*'()-._"
    return "&".join(
        (
            f"{quote('team/slug!', safe=safe)}={quote('hello & 100% 😀', safe=safe)}",
            f"{quote('version', safe=safe)}={quote('v=2', safe=safe)}",
        )
    )


def _client_with_sync_transport(
    test_api_key: str, requests: list[httpx.Request]
) -> AuthenticatedClient:
    def handle_request(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=[], request=request)

    return AuthenticatedClient(
        base_url="https://api.test",
        token=test_api_key,
        httpx_args={"transport": httpx.MockTransport(handle_request)},
    )


class _AsyncCaptureTransport(httpx.AsyncBaseTransport):
    def __init__(self, requests: list[httpx.Request]):
        self.requests = requests

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return httpx.Response(200, json=[], request=request)


def test_list_url_encodes_metadata_keys_and_values_once(monkeypatch, test_api_key):
    requests = []
    client = _client_with_sync_transport(test_api_key, requests)
    monkeypatch.setattr(sync_paginator, "get_api_client", lambda config: client)

    Sandbox.list(
        query=SandboxQuery(
            metadata={"team/slug!": "hello & 100% 😀", "version": "v=2"}
        ),
        api_key=test_api_key,
    ).next_items()

    assert requests[0].url.params.get("metadata") == _expected_metadata_query()


async def test_async_list_url_encodes_metadata_keys_and_values_once(
    monkeypatch, test_api_key
):
    requests = []
    client = AuthenticatedClient(
        base_url="https://api.test",
        token=test_api_key,
        httpx_args={"transport": _AsyncCaptureTransport(requests)},
    )
    monkeypatch.setattr(async_paginator, "get_api_client", lambda config: client)

    await AsyncSandbox.list(
        query=SandboxQuery(
            metadata={"team/slug!": "hello & 100% 😀", "version": "v=2"}
        ),
        api_key=test_api_key,
    ).next_items()

    assert requests[0].url.params.get("metadata") == _expected_metadata_query()
