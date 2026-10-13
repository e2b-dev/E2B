import re
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


def _assert_distinct_keys(keys):
    assert len(keys) == 2
    assert all(re.fullmatch(r"[a-z0-9]{32}", key) for key in keys)
    assert len(set(keys)) == 2


def test_sync_create_sends_a_fresh_idempotency_key(monkeypatch):
    keys = []

    def get_api_client(config, **kwargs):
        keys.append(kwargs["headers"][IDEMPOTENCY_KEY_HEADER])
        return object()

    monkeypatch.setattr(sync_sandbox_api, "get_api_client", get_api_client)
    monkeypatch.setattr(
        sync_sandbox_api.post_v2_sandboxes,
        "sync_detailed",
        lambda **kwargs: _response(),
    )

    for _ in range(2):
        sync_sandbox_api.SandboxApi._create_sandbox(
            "base", None, None, None, None, None
        )

    _assert_distinct_keys(keys)


@pytest.mark.asyncio
async def test_async_create_sends_a_fresh_idempotency_key(monkeypatch):
    keys = []

    def get_api_client(config, **kwargs):
        keys.append(kwargs["headers"][IDEMPOTENCY_KEY_HEADER])
        return object()

    async def create(**kwargs):
        return _response()

    monkeypatch.setattr(async_sandbox_api, "get_api_client", get_api_client)
    monkeypatch.setattr(async_sandbox_api.post_v2_sandboxes, "asyncio_detailed", create)

    for _ in range(2):
        await async_sandbox_api.SandboxApi._create_sandbox(
            "base", None, None, None, None, None
        )

    _assert_distinct_keys(keys)
