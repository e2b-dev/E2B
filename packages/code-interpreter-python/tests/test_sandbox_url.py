import pytest

from e2b.connection_config import ConnectionConfig

from e2b_code_interpreter import AsyncSandbox, Sandbox


def make_sandbox(cls, sandbox_domain=None, **config_kwargs):
    # Constructing a sandbox instance makes no network requests, so URL
    # resolution can be tested without a live sandbox.
    return cls(
        sandbox_id="test-sandbox-id",
        sandbox_domain=sandbox_domain,
        envd_version="0.2.0",
        envd_access_token=None,
        connection_config=ConnectionConfig(**config_kwargs),
    )


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    monkeypatch.delenv("E2B_SANDBOX_URL", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)
    monkeypatch.delenv("E2B_DOMAIN", raising=False)


@pytest.mark.parametrize("cls", [Sandbox, AsyncSandbox])
async def test_jupyter_url_uses_unified_endpoint_on_supported_domain(cls):
    sandbox = make_sandbox(cls, domain="e2b.app")
    assert sandbox._jupyter_url == "https://sandbox.e2b.app"


@pytest.mark.parametrize("cls", [Sandbox, AsyncSandbox])
async def test_jupyter_url_prefers_sandbox_domain_over_config_domain(cls):
    sandbox = make_sandbox(cls, sandbox_domain="e2b.dev", domain="e2b.app")
    assert sandbox._jupyter_url == "https://sandbox.e2b.dev"


@pytest.mark.parametrize("cls", [Sandbox, AsyncSandbox])
async def test_jupyter_url_points_to_per_port_host_on_unsupported_domain(cls):
    sandbox = make_sandbox(cls, domain="example.dev")
    assert sandbox._jupyter_url == "https://49999-test-sandbox-id.example.dev"


@pytest.mark.parametrize("cls", [Sandbox, AsyncSandbox])
async def test_jupyter_url_points_to_localhost_in_debug(cls):
    sandbox = make_sandbox(cls, debug=True)
    assert sandbox._jupyter_url == "http://localhost:49999"


@pytest.mark.parametrize("cls", [Sandbox, AsyncSandbox])
async def test_jupyter_url_honors_sandbox_url_option(cls):
    sandbox = make_sandbox(cls, sandbox_url="https://proxy.example.com")
    assert sandbox._jupyter_url == "https://proxy.example.com"


@pytest.mark.parametrize("cls", [Sandbox, AsyncSandbox])
async def test_jupyter_url_honors_sandbox_url_env_var(cls, monkeypatch):
    monkeypatch.setenv("E2B_SANDBOX_URL", "https://env.example.com")
    sandbox = make_sandbox(cls)
    assert sandbox._jupyter_url == "https://env.example.com"
