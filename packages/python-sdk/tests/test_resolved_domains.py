import httpx
import pytest

from e2b.api import ApiClient, AsyncApiClient
from e2b.connection_config import ConnectionConfig
from e2b.resolved_domains import ALT_USED_HEADER, clear_resolved_domains

API_KEY_A = "e2b_" + "a" * 40
API_KEY_B = "e2b_" + "b" * 40
ORIGINAL_DOMAIN = "e2b.dev"
RESOLVED_DOMAIN = "e2b-juliett.dev"


@pytest.fixture(autouse=True)
def reset_resolved_domains():
    clear_resolved_domains()
    yield
    clear_resolved_domains()


@pytest.fixture(params=(False, True), ids=("sync", "async"))
def async_mode(request):
    return request.param


async def send_request(config, async_mode, header_value, requested_hosts):
    def handler(request):
        requested_hosts.append(request.url.host)
        headers = {} if header_value is None else {ALT_USED_HEADER: header_value}
        return httpx.Response(200, headers=headers, json=[])

    transport = httpx.MockTransport(handler)
    client_type = AsyncApiClient if async_mode else ApiClient
    client = client_type(config, transport=transport)

    if async_mode:
        httpx_client = client.get_async_httpx_client()
        try:
            return await httpx_client.get("/resolved")
        finally:
            await httpx_client.aclose()

    httpx_client = client.get_httpx_client()
    try:
        return httpx_client.get("/resolved")
    finally:
        httpx_client.close()


@pytest.mark.asyncio
async def test_resolved_domain_is_cached_per_original_domain_and_api_key(
    async_mode,
):
    requested_hosts = []
    original = ConnectionConfig(domain=ORIGINAL_DOMAIN, api_key=API_KEY_A, debug=False)
    await send_request(original, async_mode, RESOLVED_DOMAIN, requested_hosts)

    resolved = ConnectionConfig(domain=ORIGINAL_DOMAIN, api_key=API_KEY_A, debug=False)
    assert resolved.domain == RESOLVED_DOMAIN
    assert resolved.api_url == f"https://api.{RESOLVED_DOMAIN}"

    await send_request(resolved, async_mode, RESOLVED_DOMAIN, requested_hosts)
    assert requested_hosts == [
        f"api.{ORIGINAL_DOMAIN}",
        f"api.{RESOLVED_DOMAIN}",
    ]

    assert (
        ConnectionConfig(domain=ORIGINAL_DOMAIN, api_key=API_KEY_B, debug=False).domain
        == ORIGINAL_DOMAIN
    )
    assert (
        ConnectionConfig(domain="other.dev", api_key=API_KEY_A, debug=False).domain
        == "other.dev"
    )


@pytest.mark.asyncio
async def test_custom_api_url_and_debug_do_not_record(async_mode):
    requested_hosts = []
    await send_request(
        ConnectionConfig(
            domain=ORIGINAL_DOMAIN,
            api_key=API_KEY_A,
            api_url="https://proxy.example",
            debug=False,
        ),
        async_mode,
        RESOLVED_DOMAIN,
        requested_hosts,
    )
    await send_request(
        ConnectionConfig(domain=ORIGINAL_DOMAIN, api_key=API_KEY_A, debug=True),
        async_mode,
        RESOLVED_DOMAIN,
        requested_hosts,
    )

    unchanged = ConnectionConfig(domain=ORIGINAL_DOMAIN, api_key=API_KEY_A, debug=False)
    assert unchanged.domain == ORIGINAL_DOMAIN
    assert unchanged.api_url == f"https://api.{ORIGINAL_DOMAIN}"
    assert requested_hosts == ["proxy.example", "localhost"]


@pytest.mark.asyncio
async def test_explicit_domain_api_url_and_rebuilt_config_are_switched(async_mode):
    requested_hosts = []
    original = ConnectionConfig(
        domain=ORIGINAL_DOMAIN,
        api_key=API_KEY_A,
        api_url=f"https://api.{ORIGINAL_DOMAIN}",
        debug=False,
    )
    await send_request(original, async_mode, RESOLVED_DOMAIN, requested_hosts)

    rebuilt = ConnectionConfig(**original.get_api_params())
    assert rebuilt.domain == RESOLVED_DOMAIN
    assert rebuilt.api_url == f"https://api.{RESOLVED_DOMAIN}"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "header_value",
    (
        "https://e2b-juliett.dev",
        "e2b-juliett.dev:443",
        "a b",
        "",
        ORIGINAL_DOMAIN,
    ),
)
async def test_invalid_or_unchanged_domains_are_ignored(async_mode, header_value):
    requested_hosts = []
    await send_request(
        ConnectionConfig(domain=ORIGINAL_DOMAIN, api_key=API_KEY_A, debug=False),
        async_mode,
        header_value,
        requested_hosts,
    )

    unchanged = ConnectionConfig(domain=ORIGINAL_DOMAIN, api_key=API_KEY_A, debug=False)
    assert unchanged.domain == ORIGINAL_DOMAIN
    assert unchanged.api_url == f"https://api.{ORIGINAL_DOMAIN}"
