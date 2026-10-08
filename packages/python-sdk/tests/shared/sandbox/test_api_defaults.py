from types import SimpleNamespace
from typing import Any, Dict
from unittest.mock import AsyncMock, Mock

import pytest

from e2b import AsyncSandbox, InvalidArgumentException, Sandbox
from e2b.api.client.api.sandboxes import (
    post_v2_sandboxes,
    post_v_2_sandboxes_sandbox_id_connect,
    post_sandboxes_sandbox_id_fork,
    post_sandboxes_sandbox_id_pause,
    post_sandboxes_sandbox_id_snapshots,
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
    monkeypatch.setattr(post_v2_sandboxes, "sync_detailed", request)

    Sandbox.create(api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


async def _async_create_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "asyncio_detailed", request)

    await AsyncSandbox.create(api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


def test_create_omits_api_owned_fields_when_unset(monkeypatch, test_api_key):
    body = _sync_create_body(monkeypatch, test_api_key)

    assert "timeout" not in body
    assert "secure" not in body
    assert "allow_internet_access" not in body


def test_create_sends_explicit_values(monkeypatch, test_api_key):
    body = _sync_create_body(
        monkeypatch,
        test_api_key,
        timeout=60,
        allow_internet_access=False,
    )

    assert body["timeout"] == 60
    assert body["allow_internet_access"] is False


def test_create_ignores_deprecated_secure(monkeypatch, test_api_key):
    body = _sync_create_body(monkeypatch, test_api_key, secure=True)

    assert "secure" not in body


async def test_async_create_omits_api_owned_fields_when_unset(
    monkeypatch, test_api_key
):
    body = await _async_create_body(monkeypatch, test_api_key)

    assert "timeout" not in body
    assert "secure" not in body
    assert "allow_internet_access" not in body


async def test_async_create_sends_explicit_values(monkeypatch, test_api_key):
    body = await _async_create_body(
        monkeypatch,
        test_api_key,
        timeout=60,
        allow_internet_access=False,
    )

    assert body["timeout"] == 60
    assert body["allow_internet_access"] is False


async def test_async_create_ignores_deprecated_secure(monkeypatch, test_api_key):
    body = await _async_create_body(monkeypatch, test_api_key, secure=True)

    assert "secure" not in body


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


def test_fork_sends_the_maximum_count(monkeypatch, test_api_key):
    body = _sync_fork_body(monkeypatch, test_api_key, count=20)

    assert body["count"] == 20


@pytest.mark.parametrize("count", [0, -1, 21, 101, 1.5, True, "abc"])
def test_fork_rejects_count_outside_1_to_20(monkeypatch, test_api_key, count):
    request = Mock(return_value=SimpleNamespace(status_code=200, parsed=[]))
    monkeypatch.setattr(post_sandboxes_sandbox_id_fork, "sync_detailed", request)

    with pytest.raises(
        InvalidArgumentException,
        match="count must be an integer between 1 and 20",
    ):
        Sandbox.fork("sbx-test", api_key=test_api_key, count=count)

    request.assert_not_called()


async def test_async_fork_omits_timeout_and_count_when_unset(monkeypatch, test_api_key):
    body = await _async_fork_body(monkeypatch, test_api_key)

    assert "timeout" not in body
    assert "count" not in body


async def test_async_fork_sends_explicit_timeout_and_count(monkeypatch, test_api_key):
    body = await _async_fork_body(monkeypatch, test_api_key, timeout=60, count=2)

    assert body["timeout"] == 60
    assert body["count"] == 2


async def test_async_fork_sends_the_maximum_count(monkeypatch, test_api_key):
    body = await _async_fork_body(monkeypatch, test_api_key, count=20)

    assert body["count"] == 20


@pytest.mark.parametrize("count", [0, -1, 21, 101, 1.5, True, "abc"])
async def test_async_fork_rejects_count_outside_1_to_20(
    monkeypatch, test_api_key, count
):
    request = AsyncMock(return_value=SimpleNamespace(status_code=200, parsed=[]))
    monkeypatch.setattr(post_sandboxes_sandbox_id_fork, "asyncio_detailed", request)

    with pytest.raises(
        InvalidArgumentException,
        match="count must be an integer between 1 and 20",
    ):
        await AsyncSandbox.fork("sbx-test", api_key=test_api_key, count=count)

    request.assert_not_called()


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


MODE_MEMORY = [("filesystem", False), ("full", True)]


def test_pause_omits_memory_when_mode_unset(monkeypatch, test_api_key):
    body = _sync_pause_body(monkeypatch, test_api_key)

    assert "memory" not in body


@pytest.mark.parametrize("mode, memory", MODE_MEMORY)
def test_pause_maps_mode_to_memory(monkeypatch, test_api_key, mode, memory):
    body = _sync_pause_body(monkeypatch, test_api_key, mode=mode)

    assert body["memory"] is memory


def test_pause_still_sends_the_deprecated_keep_memory(monkeypatch, test_api_key):
    body = _sync_pause_body(monkeypatch, test_api_key, keep_memory=False)

    assert body["memory"] is False


@pytest.mark.parametrize(
    "kwargs, match",
    [
        ({"mode": "full", "keep_memory": True}, "not both"),
        ({"mode": "memory"}, "mode must be one of: full, filesystem"),
    ],
)
def test_pause_rejects_an_invalid_mode(monkeypatch, test_api_key, kwargs, match):
    request = Mock()
    monkeypatch.setattr(post_sandboxes_sandbox_id_pause, "sync_detailed", request)

    with pytest.raises(InvalidArgumentException, match=match):
        Sandbox.pause("sbx-test", api_key=test_api_key, **kwargs)

    request.assert_not_called()


async def test_async_pause_omits_memory_when_mode_unset(monkeypatch, test_api_key):
    body = await _async_pause_body(monkeypatch, test_api_key)

    assert "memory" not in body


@pytest.mark.parametrize("mode, memory", MODE_MEMORY)
async def test_async_pause_maps_mode_to_memory(monkeypatch, test_api_key, mode, memory):
    body = await _async_pause_body(monkeypatch, test_api_key, mode=mode)

    assert body["memory"] is memory


async def test_async_pause_still_sends_the_deprecated_keep_memory(
    monkeypatch, test_api_key
):
    body = await _async_pause_body(monkeypatch, test_api_key, keep_memory=False)

    assert body["memory"] is False


def _snapshot_response():
    return SimpleNamespace(
        status_code=201,
        parsed=SimpleNamespace(snapshot_id="snap-test", names=[]),
    )


def test_create_snapshot_omits_memory_when_mode_unset(monkeypatch, test_api_key):
    request = Mock(return_value=_snapshot_response())
    monkeypatch.setattr(post_sandboxes_sandbox_id_snapshots, "sync_detailed", request)

    Sandbox.create_snapshot("sbx-test", api_key=test_api_key)

    assert "memory" not in request.call_args.kwargs["body"].to_dict()


@pytest.mark.parametrize("mode, memory", MODE_MEMORY)
def test_create_snapshot_maps_mode_to_memory(monkeypatch, test_api_key, mode, memory):
    request = Mock(return_value=_snapshot_response())
    monkeypatch.setattr(post_sandboxes_sandbox_id_snapshots, "sync_detailed", request)

    Sandbox.create_snapshot("sbx-test", mode=mode, api_key=test_api_key)

    assert request.call_args.kwargs["body"].to_dict()["memory"] is memory


@pytest.mark.parametrize("mode, memory", MODE_MEMORY)
async def test_async_create_snapshot_maps_mode_to_memory(
    monkeypatch, test_api_key, mode, memory
):
    request = AsyncMock(return_value=_snapshot_response())
    monkeypatch.setattr(
        post_sandboxes_sandbox_id_snapshots, "asyncio_detailed", request
    )

    await AsyncSandbox.create_snapshot("sbx-test", mode=mode, api_key=test_api_key)

    assert request.call_args.kwargs["body"].to_dict()["memory"] is memory


def _sync_connect_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v_2_sandboxes_sandbox_id_connect, "sync_detailed", request)

    Sandbox.connect("sbx-test", api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


async def _async_connect_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(
        post_v_2_sandboxes_sandbox_id_connect, "asyncio_detailed", request
    )

    await AsyncSandbox.connect("sbx-test", api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


def test_connect_omits_timeout_when_unset(monkeypatch, test_api_key):
    body = _sync_connect_body(monkeypatch, test_api_key)

    assert "timeout" not in body


def test_connect_sends_explicit_timeout(monkeypatch, test_api_key):
    body = _sync_connect_body(monkeypatch, test_api_key, timeout=60)

    assert body["timeout"] == 60


async def test_async_connect_omits_timeout_when_unset(monkeypatch, test_api_key):
    body = await _async_connect_body(monkeypatch, test_api_key)

    assert "timeout" not in body


async def test_async_connect_sends_explicit_timeout(monkeypatch, test_api_key):
    body = await _async_connect_body(monkeypatch, test_api_key, timeout=60)

    assert body["timeout"] == 60
