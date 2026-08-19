import httpx

from e2b.api.client.client import AuthenticatedClient
from e2b.template_async import build_api as async_build_api
from e2b.template_sync import build_api as sync_build_api

NAMESPACED = "my-team/my-template"
BASE_URL = "https://api.e2b.dev"


def _handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(404, json={"code": 404, "message": "not found"})


def _recording_client() -> tuple[AuthenticatedClient, list[httpx.Request]]:
    """Client whose requests are answered locally and recorded for assertions."""
    requests: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return _handler(request)

    transport = httpx.MockTransport(record)
    client = AuthenticatedClient(base_url=BASE_URL, token="e2b_test")
    client.set_httpx_client(httpx.Client(base_url=BASE_URL, transport=transport))
    client.set_async_httpx_client(
        httpx.AsyncClient(base_url=BASE_URL, transport=transport)
    )
    return client, requests


def test_sync_alias_check_sends_encoded_alias():
    client, requests = _recording_client()

    assert sync_build_api.check_alias_exists(client, NAMESPACED) is False

    # raw_path is what goes on the wire: the slash stays encoded, so the whole
    # alias remains a single path segment instead of splitting the route.
    assert requests[0].url.raw_path == b"/templates/aliases/my-team%2Fmy-template"


def test_sync_alias_check_leaves_plain_alias_untouched():
    client, requests = _recording_client()

    assert sync_build_api.check_alias_exists(client, "my-template") is False

    assert requests[0].url.raw_path == b"/templates/aliases/my-template"


async def test_async_alias_check_sends_encoded_alias():
    client, requests = _recording_client()

    assert await async_build_api.check_alias_exists(client, NAMESPACED) is False

    assert requests[0].url.raw_path == b"/templates/aliases/my-team%2Fmy-template"


async def test_async_alias_check_leaves_plain_alias_untouched():
    client, requests = _recording_client()

    assert await async_build_api.check_alias_exists(client, "my-template") is False

    assert requests[0].url.raw_path == b"/templates/aliases/my-template"
