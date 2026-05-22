import asyncio

import httpx
import pytest

from e2b import AsyncSandbox, SandboxQuery, SandboxState
from e2b.api.client.models import (
    NewSandbox,
    SandboxAutoResumeConfig,
)
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.sandbox_api import get_auto_resume_enabled, validate_lifecycle


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


def test_get_auto_resume_enabled_returns_none_when_lifecycle_missing():
    assert get_auto_resume_enabled(None) is None


def test_get_auto_resume_enabled_uses_auto_resume_from_lifecycle():
    assert get_auto_resume_enabled({"on_timeout": "pause", "auto_resume": True}) is True
    assert (
        get_auto_resume_enabled({"on_timeout": "pause", "auto_resume": False}) is False
    )


def test_get_auto_resume_enabled_defaults_to_false_when_missing_in_lifecycle():
    # Lifecycle present but no auto_resume key -> defaults to False.
    assert get_auto_resume_enabled({"on_timeout": "pause"}) is False
    assert get_auto_resume_enabled({"on_timeout": "kill"}) is False


def test_get_auto_resume_enabled_decoupled_from_on_timeout():
    # auto_resume is independent of on_timeout (per design).
    assert get_auto_resume_enabled({"on_timeout": "kill", "auto_resume": True}) is True
    assert (
        get_auto_resume_enabled({"on_timeout": "kill", "auto_resume": False}) is False
    )


def test_validate_lifecycle_allows_none_lifecycle():
    validate_lifecycle(None, None)
    validate_lifecycle(None, True)
    validate_lifecycle(None, False)


def test_validate_lifecycle_allows_auto_resume_with_pause():
    validate_lifecycle({"on_timeout": "pause", "auto_resume": True}, None)
    validate_lifecycle({"on_timeout": "pause", "auto_resume": True}, False)
    validate_lifecycle({"on_timeout": "pause", "auto_resume": True}, True)


def test_validate_lifecycle_allows_auto_resume_with_auto_pause_fallback():
    # No on_timeout but auto_pause=True -> effective pause -> OK.
    validate_lifecycle({"auto_resume": True}, True)  # type: ignore[typeddict-item]


def test_validate_lifecycle_allows_auto_resume_false_with_kill():
    validate_lifecycle({"on_timeout": "kill", "auto_resume": False}, None)
    validate_lifecycle({"on_timeout": "kill"}, None)


def test_validate_lifecycle_raises_when_auto_resume_true_with_kill():
    with pytest.raises(InvalidArgumentException):
        validate_lifecycle({"on_timeout": "kill", "auto_resume": True}, None)


def test_validate_lifecycle_raises_when_auto_resume_true_and_effective_is_kill():
    # No on_timeout, auto_pause falsy -> effective kill -> error.
    with pytest.raises(InvalidArgumentException):
        validate_lifecycle({"auto_resume": True}, None)  # type: ignore[typeddict-item]
    with pytest.raises(InvalidArgumentException):
        validate_lifecycle({"auto_resume": True}, False)  # type: ignore[typeddict-item]


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
