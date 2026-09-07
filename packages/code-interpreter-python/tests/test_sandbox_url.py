import pytest

from e2b.connection_config import ConnectionConfig

from e2b_code_interpreter import AsyncSandbox, Sandbox


def make_sandbox(cls, **config_kwargs):
    # Constructing a sandbox instance makes no network requests, so URL
    # resolution can be tested without a live sandbox.
    return cls(
        sandbox_id="test-sandbox-id",
        sandbox_domain=None,
        envd_version="0.2.0",
        envd_access_token=None,
        connection_config=ConnectionConfig(**config_kwargs),
    )


@pytest.mark.parametrize("cls", [Sandbox, AsyncSandbox])
async def test_jupyter_url_points_to_sandbox_host_by_default(cls, monkeypatch):
    monkeypatch.delenv("E2B_SANDBOX_URL", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)
    sandbox = make_sandbox(cls, domain="example.dev")
    assert sandbox._jupyter_url == "https://49999-test-sandbox-id.example.dev"


@pytest.mark.parametrize("cls", [Sandbox, AsyncSandbox])
async def test_jupyter_url_honors_sandbox_url_option(cls):
    sandbox = make_sandbox(cls, sandbox_url="https://proxy.example.com")
    assert sandbox._jupyter_url == "https://proxy.example.com"


@pytest.mark.parametrize("cls", [Sandbox, AsyncSandbox])
async def test_jupyter_url_honors_sandbox_url_env_var(cls, monkeypatch):
    monkeypatch.setenv("E2B_SANDBOX_URL", "https://env.example.com")
    sandbox = make_sandbox(cls)
    assert sandbox._jupyter_url == "https://env.example.com"
