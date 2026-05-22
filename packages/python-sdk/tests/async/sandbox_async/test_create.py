import asyncio

import httpx
import pytest

from e2b import AsyncSandbox, SandboxQuery, SandboxState
from e2b.api.client.models import (
    NewSandbox,
    SandboxAutoResumeConfig,
)
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.sandbox_api import get_lifecycle


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


def test_get_lifecycle_returns_defaults_when_nothing_provided():
    assert get_lifecycle(None, None) == {"on_timeout": "kill"}


def test_get_lifecycle_on_timeout_takes_precedence_over_auto_pause():
    assert get_lifecycle({"on_timeout": "kill"}, True) == {"on_timeout": "kill"}
    assert get_lifecycle({"on_timeout": "pause"}, False) == {"on_timeout": "pause"}


def test_get_lifecycle_falls_back_to_auto_pause_when_on_timeout_missing():
    # partial lifecycle without on_timeout (possible at runtime despite typing).
    assert get_lifecycle({"auto_resume": True}, True) == {  # type: ignore[typeddict-item]
        "on_timeout": "pause",
        "auto_resume": True,
    }


def test_get_lifecycle_auto_pause_only_maps_to_on_timeout():
    assert get_lifecycle(None, True) == {"on_timeout": "pause"}
    assert get_lifecycle(None, False) == {"on_timeout": "kill"}


def test_get_lifecycle_preserves_auto_resume_from_lifecycle():
    assert get_lifecycle({"on_timeout": "pause", "auto_resume": True}, None) == {
        "on_timeout": "pause",
        "auto_resume": True,
    }
    assert get_lifecycle({"on_timeout": "pause", "auto_resume": False}, None) == {
        "on_timeout": "pause",
        "auto_resume": False,
    }


def test_get_lifecycle_omits_auto_resume_when_not_set_in_lifecycle():
    # Lifecycle present but auto_resume not specified -> key omitted in result.
    assert "auto_resume" not in get_lifecycle({"on_timeout": "pause"}, None)


def test_get_lifecycle_omits_auto_resume_when_only_auto_pause_provided():
    # auto_resume is preserved verbatim from lifecycle input; bare auto_pause
    # does not introduce one.
    assert "auto_resume" not in get_lifecycle(None, True)
    assert "auto_resume" not in get_lifecycle(None, False)


def test_get_lifecycle_raises_when_auto_resume_true_with_kill():
    with pytest.raises(InvalidArgumentException):
        get_lifecycle({"on_timeout": "kill", "auto_resume": True}, None)


def test_get_lifecycle_raises_when_auto_resume_true_and_effective_is_kill():
    # No on_timeout, auto_pause falsy -> effective kill -> error.
    with pytest.raises(InvalidArgumentException):
        get_lifecycle({"auto_resume": True}, None)  # type: ignore[typeddict-item]
    with pytest.raises(InvalidArgumentException):
        get_lifecycle({"auto_resume": True}, False)  # type: ignore[typeddict-item]


def test_get_lifecycle_does_not_raise_when_auto_resume_true_with_auto_pause():
    # Partial lifecycle with auto_resume=True and auto_pause=True is valid.
    assert get_lifecycle(
        {"auto_resume": True},  # type: ignore[typeddict-item]
        True,
    ) == {"on_timeout": "pause", "auto_resume": True}


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
