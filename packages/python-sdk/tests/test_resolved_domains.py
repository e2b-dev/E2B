import httpx
import pytest

from e2b import AsyncSandbox, Sandbox
from e2b.api import ApiClient, AsyncApiClient
from e2b.connection_config import ConnectionConfig
from e2b.resolved_domains import (
    ALT_USED_HEADER,
    clear_resolved_domains,
    get_resolved_domain,
    record_resolved_domain,
)

API_KEY_A = "e2b_" + "a" * 40
API_KEY_B = "e2b_" + "b" * 40
DEFAULT_DOMAIN = "e2b.app"
RESOLVED_DOMAIN = "e2b-juliett.dev"
INELIGIBLE_CONFIGS = (
    ("opts.domain", {"domain": DEFAULT_DOMAIN}, None),
    ("opts.api_url", {"api_url": "https://api.custom.example"}, None),
    ("opts.sandbox_url", {"sandbox_url": "https://sandbox.example"}, None),
    ("E2B_DOMAIN", {}, ("E2B_DOMAIN", "e2b.custom")),
    ("E2B_API_URL", {}, ("E2B_API_URL", "https://api.custom.example")),
    (
        "E2B_SANDBOX_URL",
        {},
        ("E2B_SANDBOX_URL", "https://sandbox.example"),
    ),
    ("debug option", {"debug": True}, None),
    ("E2B_DEBUG", {}, ("E2B_DEBUG", "true")),
)
TEST_ENV_VARS = (
    "E2B_DOMAIN",
    "E2B_API_URL",
    "E2B_SANDBOX_URL",
    "E2B_DEBUG",
)


@pytest.fixture(autouse=True)
def reset_resolved_domains(monkeypatch):
    for name in TEST_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
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
async def test_default_config_caches_domain_by_api_key(async_mode):
    requested_hosts = []
    await send_request(
        ConnectionConfig(api_key=API_KEY_A),
        async_mode,
        RESOLVED_DOMAIN,
        requested_hosts,
    )

    resolved = ConnectionConfig(api_key=API_KEY_A)
    assert resolved.domain == RESOLVED_DOMAIN
    assert resolved.api_url == f"https://api.{RESOLVED_DOMAIN}"
    assert get_resolved_domain(API_KEY_A) == RESOLVED_DOMAIN

    await send_request(resolved, async_mode, RESOLVED_DOMAIN, requested_hosts)
    assert requested_hosts == [
        f"api.{DEFAULT_DOMAIN}",
        f"api.{RESOLVED_DOMAIN}",
    ]

    assert ConnectionConfig(api_key=API_KEY_B).domain == DEFAULT_DOMAIN


@pytest.mark.asyncio
@pytest.mark.parametrize(("name", "options", "env"), INELIGIBLE_CONFIGS)
async def test_ineligible_config_does_not_record_or_switch(
    async_mode, monkeypatch, name, options, env
):
    if env:
        monkeypatch.setenv(*env)

    ineligible = ConnectionConfig(api_key=API_KEY_A, **options)
    assert ineligible._discover_domain is False
    requested_hosts = []
    await send_request(ineligible, async_mode, RESOLVED_DOMAIN, requested_hosts)

    if env:
        monkeypatch.delenv(env[0], raising=False)
    assert ConnectionConfig(api_key=API_KEY_A).domain == DEFAULT_DOMAIN
    assert get_resolved_domain(API_KEY_A) is None

    clear_resolved_domains()
    record_resolved_domain(API_KEY_A, RESOLVED_DOMAIN)
    if env:
        monkeypatch.setenv(*env)
    cached_config = ConnectionConfig(api_key=API_KEY_A, **options)
    expected_domain = options.get("domain") or (
        env[1] if env and env[0] == "E2B_DOMAIN" else DEFAULT_DOMAIN
    )
    assert cached_config.domain == expected_domain


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "header_value",
    (
        "https://e2b-juliett.dev",
        "e2b-juliett.dev:443",
        "a b",
        "",
    ),
)
async def test_malformed_response_domains_are_ignored(async_mode, header_value):
    requested_hosts = []
    await send_request(
        ConnectionConfig(api_key=API_KEY_A),
        async_mode,
        header_value,
        requested_hosts,
    )

    unchanged = ConnectionConfig(api_key=API_KEY_A)
    assert unchanged.domain == DEFAULT_DOMAIN
    assert unchanged.api_url == f"https://api.{DEFAULT_DOMAIN}"


@pytest.mark.asyncio
async def test_valid_header_matching_default_domain_is_cached(async_mode):
    await send_request(
        ConnectionConfig(api_key=API_KEY_A),
        async_mode,
        DEFAULT_DOMAIN,
        [],
    )
    assert get_resolved_domain(API_KEY_A) == DEFAULT_DOMAIN


@pytest.mark.asyncio
async def test_sandbox_create_uses_cached_domain(async_mode, monkeypatch):
    requested_hosts = []
    clients = []

    def handler(request):
        requested_hosts.append(request.url.host)
        return httpx.Response(
            201,
            headers={ALT_USED_HEADER: RESOLVED_DOMAIN},
            json={
                "templateID": "base",
                "sandboxID": "sandbox-id",
                "clientID": "client-id",
                "envdVersion": "0.4.0",
                "domain": None,
            },
        )

    def make_sync_client(config, **kwargs):
        client = ApiClient(config, transport=httpx.MockTransport(handler))
        clients.append(client)
        return client

    def make_async_client(config, **kwargs):
        client = AsyncApiClient(config, transport=httpx.MockTransport(handler))
        clients.append(client)
        return client

    monkeypatch.setattr("e2b.sandbox_sync.sandbox_api.get_api_client", make_sync_client)
    monkeypatch.setattr(
        "e2b.sandbox_async.sandbox_api.get_api_client", make_async_client
    )

    try:
        if async_mode:
            await AsyncSandbox.create(api_key=API_KEY_A)
            sandbox = await AsyncSandbox.create(api_key=API_KEY_A)
        else:
            Sandbox.create(api_key=API_KEY_A)
            sandbox = Sandbox.create(api_key=API_KEY_A)

        assert sandbox.sandbox_domain == RESOLVED_DOMAIN
        assert requested_hosts == [
            f"api.{DEFAULT_DOMAIN}",
            f"api.{RESOLVED_DOMAIN}",
        ]
    finally:
        for client in clients:
            if async_mode:
                await client.get_async_httpx_client().aclose()
            else:
                client.get_httpx_client().close()
