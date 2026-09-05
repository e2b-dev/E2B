from types import SimpleNamespace
from typing import Any, Dict
from unittest.mock import AsyncMock, Mock

from e2b.api.client.api.templates import post_v3_templates
from e2b.api.client.models import TemplateRequestResponseV3
from e2b.template_async.build_api import request_build as async_request_build
from e2b.template_sync.build_api import request_build as sync_request_build


def _build_response():
    return SimpleNamespace(
        status_code=200,
        parsed=TemplateRequestResponseV3(
            template_id="template-id",
            build_id="build-id",
            public=False,
            names=[],
            tags=[],
            aliases=[],
        ),
    )


def _sync_build_body(monkeypatch, **kwargs) -> Dict[str, Any]:
    request = Mock(return_value=_build_response())
    monkeypatch.setattr(post_v3_templates, "sync_detailed", request)

    sync_request_build(Mock(), name="test-template", tags=None, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


async def _async_build_body(monkeypatch, **kwargs) -> Dict[str, Any]:
    request = AsyncMock(return_value=_build_response())
    monkeypatch.setattr(post_v3_templates, "asyncio_detailed", request)

    await async_request_build(Mock(), name="test-template", tags=None, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


def test_build_omits_cpu_and_memory_when_unset(monkeypatch):
    body = _sync_build_body(monkeypatch, cpu_count=None, memory_mb=None)

    assert "cpuCount" not in body
    assert "memoryMB" not in body


def test_build_sends_explicit_cpu_and_memory(monkeypatch):
    body = _sync_build_body(monkeypatch, cpu_count=1, memory_mb=512)

    assert body["cpuCount"] == 1
    assert body["memoryMB"] == 512


async def test_async_build_omits_cpu_and_memory_when_unset(monkeypatch):
    body = await _async_build_body(monkeypatch, cpu_count=None, memory_mb=None)

    assert "cpuCount" not in body
    assert "memoryMB" not in body


async def test_async_build_sends_explicit_cpu_and_memory(monkeypatch):
    body = await _async_build_body(monkeypatch, cpu_count=1, memory_mb=512)

    assert body["cpuCount"] == 1
    assert body["memoryMB"] == 512
