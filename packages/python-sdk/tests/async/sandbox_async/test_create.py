import asyncio
from typing import Any, cast

import httpx
import pytest

from e2b import AsyncSandbox, SandboxQuery, SandboxState
from e2b.api.client.models import (
    NewSandbox,
    SandboxAutoResumeConfig,
)
from e2b.exceptions import InvalidArgumentException


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


def test_create_payload_serializes_auto_resume_enabled():
    body = NewSandbox(
        template_id="template-id",
        auto_pause=True,
        auto_resume=SandboxAutoResumeConfig(enabled=True),
    )

    assert body.to_dict()["autoPause"] is True
    assert body.to_dict()["autoResume"] == {"enabled": True}


def test_create_payload_deserializes_auto_resume_enabled():
    body = NewSandbox.from_dict(
        {
            "templateID": "template-id",
            "autoPause": False,
            "autoResume": {"enabled": False},
        }
    )

    assert isinstance(body.auto_resume, SandboxAutoResumeConfig)
    assert body.auto_resume.to_dict() == {"enabled": False}


def test_create_payload_serializes_auto_pause_memory():
    body = NewSandbox(
        template_id="template-id",
        auto_pause=True,
        auto_pause_memory=False,
    )

    assert body.to_dict()["autoPauseMemory"] is False


@pytest.mark.skip_debug()
async def test_filesystem_only_auto_pause_rejects_auto_resume():
    # A filesystem-only auto-pause snapshot can only be resumed explicitly, so
    # combining keep_memory=False with auto_resume is rejected client-side.
    with pytest.raises(InvalidArgumentException):
        await AsyncSandbox.create(
            timeout=3,
            lifecycle={
                "on_timeout": {"action": "pause", "keep_memory": False},
                "auto_resume": True,
            },
        )


@pytest.mark.skip_debug()
async def test_keep_memory_not_allowed_with_kill():
    # The discriminated union forbids keep_memory on action="kill" at type-check
    # time; the runtime guard rejects it for callers that bypass the type
    # (cast(Any, ...) feeds the deliberately type-invalid input).
    with pytest.raises(InvalidArgumentException):
        await AsyncSandbox.create(
            timeout=3,
            lifecycle=cast(
                Any, {"on_timeout": {"action": "kill", "keep_memory": False}}
            ),
        )


@pytest.mark.skip_debug()
async def test_keep_memory_none_defaults_to_full_memory(async_sandbox_factory):
    # An explicit None keep_memory must default to full memory (not filesystem-only):
    # the timeout auto-pause then resumes the SAME sandbox in place (memory restore),
    # so the boot id is unchanged. A changed boot id would mean None was wrongly
    # treated as filesystem-only (cold boot).
    sbx = await async_sandbox_factory(
        timeout=60,
        lifecycle={"on_timeout": {"action": "pause", "keep_memory": None}},
    )
    boot_before = (await sbx.files.read("/proc/sys/kernel/random/boot_id")).strip()

    await sbx.set_timeout(0)  # force the timeout auto-pause now
    for _ in range(150):
        if not await sbx.is_running():
            break
        await asyncio.sleep(0.2)
    assert not await sbx.is_running()

    resumed = await sbx.connect()
    assert resumed.sandbox_id == sbx.sandbox_id  # same sandbox
    boot_after = (await resumed.files.read("/proc/sys/kernel/random/boot_id")).strip()
    assert boot_after == boot_before  # memory restore in place, not a cold boot


@pytest.mark.skip_debug()
async def test_auto_pause_filesystem_only_reboots(async_sandbox_factory):
    # keep_memory=False makes the timeout auto-pause filesystem-only, so resuming
    # cold-boots the sandbox from disk.
    sandbox = await async_sandbox_factory(
        timeout=3,
        lifecycle={"on_timeout": {"action": "pause", "keep_memory": False}},
    )

    marker = "auto-pause-fs-only"
    await sandbox.commands.run(f"echo {marker} > /home/user/auto-pause-marker.txt")
    boot_before = (
        await sandbox.commands.run("cat /proc/sys/kernel/random/boot_id")
    ).stdout.strip()

    await asyncio.sleep(5)

    assert (await sandbox.get_info()).state == SandboxState.PAUSED
    assert not await sandbox.is_running()

    # A filesystem-only snapshot cannot auto-resume on traffic; connect resumes
    # it by cold-booting.
    resumed = await sandbox.connect()
    assert await resumed.is_running()

    persisted = (
        await resumed.commands.run("cat /home/user/auto-pause-marker.txt")
    ).stdout.strip()
    assert persisted == marker

    boot_after = (
        await resumed.commands.run("cat /proc/sys/kernel/random/boot_id")
    ).stdout.strip()
    assert boot_after != boot_before


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
