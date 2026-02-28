import asyncio

import httpx
import pytest

from e2b import AsyncSandbox, SandboxQuery, SandboxState
from e2b.api.client.models import (
    NewSandbox,
    SandboxAutoResumeConfig,
    SandboxAutoResumePolicy,
)
from e2b.sandbox.sandbox_api import get_auto_resume_policy


@pytest.mark.skip_debug()
async def test_start(async_sandbox):
    assert await async_sandbox.is_running()
    assert async_sandbox._envd_version is not None


@pytest.mark.skip_debug()
async def test_metadata(async_sandbox_factory):
    sbx = await async_sandbox_factory(timeout=5, metadata={"test-key": "test-value"})

    paginator = AsyncSandbox.list(
        query=SandboxQuery(metadata={"test-key": "test-value"})
    )
    sandboxes = await paginator.next_items()

    for sbx_info in sandboxes:
        if sbx.sandbox_id == sbx_info.sandbox_id:
            assert sbx_info.metadata is not None
            assert sbx_info.metadata["test-key"] == "test-value"
            break
    else:
        assert False, "Sandbox not found"


def test_lifecycle_auto_resume_policy_mapping():
    assert get_auto_resume_policy({"on_timeout": "pause", "auto_resume": True}) == "any"
    assert (
        get_auto_resume_policy({"on_timeout": "pause", "auto_resume": False}) == "off"
    )
    assert get_auto_resume_policy({"on_timeout": "pause"}) == "off"
    assert get_auto_resume_policy({"on_timeout": "kill", "auto_resume": False}) is None
    assert get_auto_resume_policy({"on_timeout": "kill"}) is None
    assert get_auto_resume_policy(None) is None


def test_create_payload_serializes_auto_resume_policy():
    body = NewSandbox(
        template_id="template-id",
        auto_pause=True,
        auto_resume=SandboxAutoResumeConfig(policy=SandboxAutoResumePolicy.ANY),
    )

    assert body.to_dict()["autoPause"] is True
    assert body.to_dict()["autoResume"] == {"policy": "any"}


def test_create_payload_deserializes_auto_resume_policy():
    body = NewSandbox.from_dict(
        {
            "templateID": "template-id",
            "autoPause": False,
            "autoResume": {"policy": "off"},
        }
    )

    assert isinstance(body.auto_resume, SandboxAutoResumeConfig)
    assert body.auto_resume.to_dict() == {"policy": "off"}


@pytest.mark.skip_debug()
async def test_auto_pause_without_auto_resume_requires_connect(async_sandbox_factory):
    sandbox = await async_sandbox_factory(
        timeout=3,
        lifecycle={"on_timeout": "pause", "auto_resume": False},
    )

    await asyncio.sleep(5)

    assert (await sandbox.get_info()).state == SandboxState.PAUSED
    assert not await sandbox.is_running()

    await sandbox.connect()

    assert (await sandbox.get_info()).state == SandboxState.RUNNING
    assert await sandbox.is_running()


@pytest.mark.skip_debug()
async def test_auto_resume_wakes_on_http_request(async_sandbox_factory):
    sandbox = await async_sandbox_factory(
        timeout=3,
        lifecycle={"on_timeout": "pause", "auto_resume": True},
    )

    cmd = await sandbox.commands.run("python3 -m http.server 8000", background=True)
    try:
        await asyncio.sleep(5)

        url = f"https://{sandbox.get_host(8000)}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url)

        assert res.status_code == 200
        assert (await sandbox.get_info()).state == SandboxState.RUNNING
        assert await sandbox.is_running()
    finally:
        try:
            await cmd.kill()
        except Exception:
            pass
