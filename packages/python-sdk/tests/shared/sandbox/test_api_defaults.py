from types import SimpleNamespace
from typing import Any, Dict
from unittest.mock import AsyncMock, Mock

from e2b import AsyncSandbox, Sandbox
from e2b.api.client.api.sandboxes import (
    post_sandboxes,
    post_sandboxes_sandbox_id_fork,
    post_sandboxes_sandbox_id_pause,
)
from e2b.api.client.models import Sandbox as SandboxModel


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


def _sync_create_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    Sandbox.create(api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


async def _async_create_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "asyncio_detailed", request)

    await AsyncSandbox.create(api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


def test_create_omits_api_owned_fields_when_unset(monkeypatch, test_api_key):
    body = _sync_create_body(monkeypatch, test_api_key)

    assert "timeout" not in body
    assert body["secure"] is True
    assert "allow_internet_access" not in body


def test_create_sends_explicit_values(monkeypatch, test_api_key):
    body = _sync_create_body(
        monkeypatch,
        test_api_key,
        timeout=60,
        secure=False,
        allow_internet_access=False,
    )

    assert body["timeout"] == 60
    assert body["secure"] is False
    assert body["allow_internet_access"] is False


async def test_async_create_omits_api_owned_fields_when_unset(
    monkeypatch, test_api_key
):
    body = await _async_create_body(monkeypatch, test_api_key)

    assert "timeout" not in body
    assert body["secure"] is True
    assert "allow_internet_access" not in body


async def test_async_create_sends_explicit_values(monkeypatch, test_api_key):
    body = await _async_create_body(
        monkeypatch,
        test_api_key,
        timeout=60,
        secure=False,
        allow_internet_access=False,
    )

    assert body["timeout"] == 60
    assert body["secure"] is False
    assert body["allow_internet_access"] is False


def _sync_fork_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = Mock(return_value=SimpleNamespace(status_code=200, parsed=[]))
    monkeypatch.setattr(post_sandboxes_sandbox_id_fork, "sync_detailed", request)

    Sandbox.fork("sbx-test", api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


async def _async_fork_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = AsyncMock(return_value=SimpleNamespace(status_code=200, parsed=[]))
    monkeypatch.setattr(post_sandboxes_sandbox_id_fork, "asyncio_detailed", request)

    await AsyncSandbox.fork("sbx-test", api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


def test_fork_omits_timeout_and_count_when_unset(monkeypatch, test_api_key):
    body = _sync_fork_body(monkeypatch, test_api_key)

    assert "timeout" not in body
    assert "count" not in body


def test_fork_sends_explicit_timeout_and_count(monkeypatch, test_api_key):
    body = _sync_fork_body(monkeypatch, test_api_key, timeout=60, count=2)

    assert body["timeout"] == 60
    assert body["count"] == 2


async def test_async_fork_omits_timeout_and_count_when_unset(monkeypatch, test_api_key):
    body = await _async_fork_body(monkeypatch, test_api_key)

    assert "timeout" not in body
    assert "count" not in body


async def test_async_fork_sends_explicit_timeout_and_count(monkeypatch, test_api_key):
    body = await _async_fork_body(monkeypatch, test_api_key, timeout=60, count=2)

    assert body["timeout"] == 60
    assert body["count"] == 2


def _sync_pause_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = Mock(return_value=SimpleNamespace(status_code=204, parsed=None))
    monkeypatch.setattr(post_sandboxes_sandbox_id_pause, "sync_detailed", request)

    Sandbox.pause("sbx-test", api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


async def _async_pause_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = AsyncMock(return_value=SimpleNamespace(status_code=204, parsed=None))
    monkeypatch.setattr(post_sandboxes_sandbox_id_pause, "asyncio_detailed", request)

    await AsyncSandbox.pause("sbx-test", api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


def test_pause_omits_memory_when_keep_memory_unset(monkeypatch, test_api_key):
    body = _sync_pause_body(monkeypatch, test_api_key)

    assert "memory" not in body


def test_pause_sends_explicit_keep_memory(monkeypatch, test_api_key):
    body = _sync_pause_body(monkeypatch, test_api_key, keep_memory=False)

    assert body["memory"] is False


async def test_async_pause_omits_memory_when_keep_memory_unset(
    monkeypatch, test_api_key
):
    body = await _async_pause_body(monkeypatch, test_api_key)

    assert "memory" not in body


async def test_async_pause_sends_explicit_keep_memory(monkeypatch, test_api_key):
    body = await _async_pause_body(monkeypatch, test_api_key, keep_memory=False)

    assert body["memory"] is False
