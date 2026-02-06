from types import SimpleNamespace

import pytest

from e2b.sandbox_async.sandbox_api import SandboxApi
import e2b.sandbox_async.sandbox_api as sandbox_api_mod


def _fake_parsed_response():
    return SimpleNamespace(
        sandbox_id="sandbox-123",
        domain=None,
        envd_version="0.2.4",
        envd_access_token=None,
        traffic_access_token=None,
    )


@pytest.mark.asyncio
async def test_create_sandbox_includes_auto_resume_when_set(monkeypatch):
    captured = {}

    def fake_get_api_client(_config):
        return object()

    async def fake_asyncio_detailed(*, body, client):
        captured["body"] = body
        assert client is not None
        return SimpleNamespace(status_code=201, parsed=_fake_parsed_response())

    monkeypatch.setattr(sandbox_api_mod, "get_api_client", fake_get_api_client)
    monkeypatch.setattr(
        sandbox_api_mod.post_sandboxes, "asyncio_detailed", fake_asyncio_detailed
    )

    await SandboxApi._create_sandbox(
        template="base",
        timeout=5,
        auto_pause=False,
        auto_resume={"policy": "any"},
        allow_internet_access=True,
        metadata=None,
        env_vars=None,
        secure=True,
    )

    payload = captured["body"].to_dict()
    assert payload["autoResume"] == {"policy": "any"}


@pytest.mark.asyncio
async def test_create_sandbox_omits_auto_resume_when_none(monkeypatch):
    captured = {}

    def fake_get_api_client(_config):
        return object()

    async def fake_asyncio_detailed(*, body, client):
        captured["body"] = body
        assert client is not None
        return SimpleNamespace(status_code=201, parsed=_fake_parsed_response())

    monkeypatch.setattr(sandbox_api_mod, "get_api_client", fake_get_api_client)
    monkeypatch.setattr(
        sandbox_api_mod.post_sandboxes, "asyncio_detailed", fake_asyncio_detailed
    )

    await SandboxApi._create_sandbox(
        template="base",
        timeout=5,
        auto_pause=False,
        auto_resume=None,
        allow_internet_access=True,
        metadata=None,
        env_vars=None,
        secure=True,
    )

    payload = captured["body"].to_dict()
    assert "autoResume" not in payload

