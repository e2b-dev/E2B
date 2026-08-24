"""Volume mounts in the sandbox create request — pure client-side shaping.

Mirrors `tests/volume/mountPayload.test.ts` in the JS SDK. The mount itself is
server-side behavior and is covered by the e2e tier (`test_mount.py`).
"""

from types import SimpleNamespace
from typing import Any, Dict
from unittest.mock import AsyncMock, Mock

from e2b import AsyncSandbox, Sandbox, Volume
from e2b.api.client.api.sandboxes import post_sandboxes
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


def _sync_request_body(monkeypatch, api_key: str, volume_mounts) -> Dict[str, Any]:
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    Sandbox.create(api_key=api_key, volume_mounts=volume_mounts)

    return request.call_args.kwargs["body"].to_dict()


async def _async_request_body(
    monkeypatch, api_key: str, volume_mounts
) -> Dict[str, Any]:
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "asyncio_detailed", request)

    await AsyncSandbox.create(api_key=api_key, volume_mounts=volume_mounts)

    return request.call_args.kwargs["body"].to_dict()


def test_create_omits_volume_mounts_when_none_are_requested(monkeypatch, test_api_key):
    body = _sync_request_body(monkeypatch, test_api_key, None)

    assert "volumeMounts" not in body


def test_create_maps_mount_paths_to_named_volume_mounts(monkeypatch, test_api_key):
    body = _sync_request_body(monkeypatch, test_api_key, {"/mnt/data": "my-volume"})

    assert body["volumeMounts"] == [{"name": "my-volume", "path": "/mnt/data"}]


def test_create_accepts_a_volume_instance_as_the_mount_source(
    monkeypatch, test_api_key
):
    volume = Volume("vol-1", "my-volume", "volume-token")

    body = _sync_request_body(monkeypatch, test_api_key, {"/mnt/data": volume})

    assert body["volumeMounts"] == [{"name": "my-volume", "path": "/mnt/data"}]


async def test_async_create_maps_mount_paths_to_named_volume_mounts(
    monkeypatch, test_api_key
):
    body = await _async_request_body(
        monkeypatch, test_api_key, {"/mnt/data": "my-volume"}
    )

    assert body["volumeMounts"] == [{"name": "my-volume", "path": "/mnt/data"}]
