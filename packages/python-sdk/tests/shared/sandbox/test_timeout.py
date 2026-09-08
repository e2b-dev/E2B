from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from e2b import AsyncSandbox, Sandbox
from e2b.api.client.api.sandboxes import (
    post_sandboxes,
    post_sandboxes_sandbox_id_connect,
)
from e2b.api.client.models import Sandbox as SandboxModel
from e2b.sandbox.main import SandboxBase


def _created_sandbox():
    return SimpleNamespace(
        status_code=200,
        parsed=SandboxModel(
            client_id="client-id",
            envd_version="0.2.4",
            sandbox_id="sbx-test",
            template_id="template-id",
        ),
    )


def test_create_sends_timeout_zero(monkeypatch, test_api_key):
    # timeout=0 is a value. `timeout or default` used to send 300 instead.
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    Sandbox.create(api_key=test_api_key, timeout=0)

    assert request.call_args.kwargs["body"].to_dict()["timeout"] == 0


def test_create_omitted_timeout_uses_default(monkeypatch, test_api_key):
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    Sandbox.create(api_key=test_api_key)

    assert (
        request.call_args.kwargs["body"].to_dict()["timeout"]
        == SandboxBase.default_sandbox_timeout
    )


async def test_async_create_sends_timeout_zero(monkeypatch, test_api_key):
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "asyncio_detailed", request)

    await AsyncSandbox.create(api_key=test_api_key, timeout=0)

    assert request.call_args.kwargs["body"].to_dict()["timeout"] == 0


async def test_async_create_omitted_timeout_uses_default(monkeypatch, test_api_key):
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "asyncio_detailed", request)

    await AsyncSandbox.create(api_key=test_api_key)

    assert (
        request.call_args.kwargs["body"].to_dict()["timeout"]
        == SandboxBase.default_sandbox_timeout
    )


def test_connect_sends_timeout_zero(monkeypatch, test_api_key):
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes_sandbox_id_connect, "sync_detailed", request)

    Sandbox.connect("sbx-test", timeout=0, api_key=test_api_key)

    assert request.call_args.kwargs["body"].to_dict()["timeout"] == 0


async def test_async_connect_sends_timeout_zero(monkeypatch, test_api_key):
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes_sandbox_id_connect, "asyncio_detailed", request)

    await AsyncSandbox.connect("sbx-test", timeout=0, api_key=test_api_key)

    assert request.call_args.kwargs["body"].to_dict()["timeout"] == 0
