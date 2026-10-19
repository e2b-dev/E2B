from types import SimpleNamespace

import pytest

from e2b.retry import IDEMPOTENCY_KEY_HEADER
from e2b.sandbox_async import sandbox_api as async_sandbox_api
from e2b.sandbox_sync import sandbox_api as sync_sandbox_api


def _response():
    return SimpleNamespace(
        status_code=201,
        parsed=SimpleNamespace(
            sandbox_id="sandbox-id",
            domain=None,
            envd_version="0.2.4",
            envd_access_token=None,
            traffic_access_token=None,
        ),
    )


def test_sync_create_sends_configured_idempotency_key(monkeypatch):
    headers = []

    def get_api_client(config, **kwargs):
        headers.append(kwargs.get("headers"))
        return object()

    monkeypatch.setattr(sync_sandbox_api, "get_api_client", get_api_client)
    monkeypatch.setattr(
        sync_sandbox_api.post_v2_sandboxes,
        "sync_detailed",
        lambda **kwargs: _response(),
    )

    sync_sandbox_api.SandboxApi._create_sandbox(
        "base", None, None, None, None, None, idempotency_key="abc123"
    )

    assert headers == [{IDEMPOTENCY_KEY_HEADER: "abc123"}]


@pytest.mark.asyncio
async def test_async_create_sends_configured_idempotency_key(monkeypatch):
    headers = []

    def get_api_client(config, **kwargs):
        headers.append(kwargs.get("headers"))
        return object()

    async def create(**kwargs):
        return _response()

    monkeypatch.setattr(async_sandbox_api, "get_api_client", get_api_client)
    monkeypatch.setattr(async_sandbox_api.post_v2_sandboxes, "asyncio_detailed", create)

    await async_sandbox_api.SandboxApi._create_sandbox(
        "base", None, None, None, None, None, idempotency_key="abc123"
    )

    assert headers == [{IDEMPOTENCY_KEY_HEADER: "abc123"}]


def test_sync_create_does_not_send_idempotency_key_when_unset(monkeypatch):
    headers = []

    def get_api_client(config, **kwargs):
        headers.append(kwargs.get("headers"))
        return object()

    monkeypatch.setattr(sync_sandbox_api, "get_api_client", get_api_client)
    monkeypatch.setattr(
        sync_sandbox_api.post_v2_sandboxes,
        "sync_detailed",
        lambda **kwargs: _response(),
    )

    sync_sandbox_api.SandboxApi._create_sandbox("base", None, None, None, None, None)

    assert headers == [None]


@pytest.mark.asyncio
async def test_async_create_does_not_send_idempotency_key_when_unset(monkeypatch):
    headers = []

    def get_api_client(config, **kwargs):
        headers.append(kwargs.get("headers"))
        return object()

    async def create(**kwargs):
        return _response()

    monkeypatch.setattr(async_sandbox_api, "get_api_client", get_api_client)
    monkeypatch.setattr(async_sandbox_api.post_v2_sandboxes, "asyncio_detailed", create)

    await async_sandbox_api.SandboxApi._create_sandbox(
        "base", None, None, None, None, None
    )

    assert headers == [None]
