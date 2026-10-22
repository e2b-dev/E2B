from types import SimpleNamespace

import pytest

from e2b.api.client.types import UNSET
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
    idempotency_keys = []

    def get_api_client(config):
        return object()

    def create(**kwargs):
        idempotency_keys.append(kwargs["idempotency_key"])
        return _response()

    monkeypatch.setattr(sync_sandbox_api, "get_api_client", get_api_client)
    monkeypatch.setattr(sync_sandbox_api.post_v2_sandboxes, "sync_detailed", create)

    sync_sandbox_api.SandboxApi._create_sandbox(
        "base", None, None, None, None, None, idempotency_key="abc123"
    )

    assert idempotency_keys == ["abc123"]


@pytest.mark.asyncio
async def test_async_create_sends_configured_idempotency_key(monkeypatch):
    idempotency_keys = []

    def get_api_client(config):
        return object()

    async def create(**kwargs):
        idempotency_keys.append(kwargs["idempotency_key"])
        return _response()

    monkeypatch.setattr(async_sandbox_api, "get_api_client", get_api_client)
    monkeypatch.setattr(async_sandbox_api.post_v2_sandboxes, "asyncio_detailed", create)

    await async_sandbox_api.SandboxApi._create_sandbox(
        "base", None, None, None, None, None, idempotency_key="abc123"
    )

    assert idempotency_keys == ["abc123"]


def test_sync_create_does_not_send_idempotency_key_when_unset(monkeypatch):
    idempotency_keys = []

    def get_api_client(config):
        return object()

    def create(**kwargs):
        idempotency_keys.append(kwargs["idempotency_key"])
        return _response()

    monkeypatch.setattr(sync_sandbox_api, "get_api_client", get_api_client)
    monkeypatch.setattr(sync_sandbox_api.post_v2_sandboxes, "sync_detailed", create)

    sync_sandbox_api.SandboxApi._create_sandbox("base", None, None, None, None, None)

    assert idempotency_keys == [UNSET]


@pytest.mark.asyncio
async def test_async_create_does_not_send_idempotency_key_when_unset(monkeypatch):
    idempotency_keys = []

    def get_api_client(config):
        return object()

    async def create(**kwargs):
        idempotency_keys.append(kwargs["idempotency_key"])
        return _response()

    monkeypatch.setattr(async_sandbox_api, "get_api_client", get_api_client)
    monkeypatch.setattr(async_sandbox_api.post_v2_sandboxes, "asyncio_detailed", create)

    await async_sandbox_api.SandboxApi._create_sandbox(
        "base", None, None, None, None, None
    )

    assert idempotency_keys == [UNSET]
