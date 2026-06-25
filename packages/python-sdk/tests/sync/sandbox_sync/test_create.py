from time import sleep

import httpx
import pytest

from e2b import Sandbox, SandboxState
from e2b.api.client.models import (
    NewSandbox,
    SandboxAutoResumeConfig,
)
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.sandbox_api import SandboxQuery


@pytest.mark.skip_debug()
def test_start(sandbox_factory):
    sbx = sandbox_factory(timeout=5)

    assert sbx.is_running()
    assert sbx._envd_version is not None


@pytest.mark.skip_debug()
def test_metadata(sandbox_factory):
    sbx = sandbox_factory(timeout=5, metadata={"test-key": "test-value"})

    paginator = Sandbox.list(query=SandboxQuery(metadata={"test-key": "test-value"}))
    sandboxes = paginator.next_items()

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
def test_filesystem_only_auto_pause_rejects_auto_resume():
    # A filesystem-only auto-pause snapshot can only be resumed explicitly, so
    # combining keep_memory=False with auto_resume is rejected client-side.
    with pytest.raises(InvalidArgumentException):
        Sandbox.create(
            timeout=3,
            lifecycle={
                "on_timeout": "pause",
                "auto_resume": True,
                "keep_memory": False,
            },
        )


@pytest.mark.skip_debug()
def test_filesystem_only_auto_pause_requires_pause():
    # keep_memory only governs a timeout auto-pause, so keep_memory=False without
    # on_timeout="pause" is rejected client-side.
    with pytest.raises(InvalidArgumentException):
        Sandbox.create(
            timeout=3,
            lifecycle={"on_timeout": "kill", "keep_memory": False},
        )


@pytest.mark.skip_debug()
def test_auto_pause_filesystem_only_reboots(sandbox_factory):
    # keep_memory=False makes the timeout auto-pause filesystem-only, so resuming
    # cold-boots the sandbox from disk.
    sandbox = sandbox_factory(
        timeout=3,
        lifecycle={"on_timeout": "pause", "keep_memory": False},
    )

    marker = "auto-pause-fs-only"
    sandbox.commands.run(f"echo {marker} > /home/user/auto-pause-marker.txt")
    boot_before = sandbox.commands.run(
        "cat /proc/sys/kernel/random/boot_id"
    ).stdout.strip()

    sleep(5)

    assert sandbox.get_info().state == SandboxState.PAUSED
    assert not sandbox.is_running()

    # A filesystem-only snapshot cannot auto-resume on traffic; connect resumes
    # it by cold-booting.
    resumed = sandbox.connect()
    assert resumed.is_running()

    persisted = resumed.commands.run(
        "cat /home/user/auto-pause-marker.txt"
    ).stdout.strip()
    assert persisted == marker

    boot_after = resumed.commands.run(
        "cat /proc/sys/kernel/random/boot_id"
    ).stdout.strip()
    assert boot_after != boot_before


@pytest.mark.skip_debug()
def test_auto_pause_without_auto_resume_requires_connect(sandbox_factory):
    sandbox = sandbox_factory(
        timeout=3,
        lifecycle={"on_timeout": "pause", "auto_resume": False},
    )

    sleep(5)

    assert sandbox.get_info().state == SandboxState.PAUSED
    assert not sandbox.is_running()

    sandbox.connect()

    assert sandbox.get_info().state == SandboxState.RUNNING
    assert sandbox.is_running()


@pytest.mark.skip_debug()
def test_auto_resume_wakes_on_http_request(sandbox_factory):
    sandbox = sandbox_factory(
        timeout=3,
        lifecycle={"on_timeout": "pause", "auto_resume": True},
    )

    cmd = sandbox.commands.run("python3 -m http.server 8000", background=True)
    try:
        sleep(5)

        url = f"https://{sandbox.get_host(8000)}"
        res = httpx.get(url, timeout=15.0)

        assert res.status_code == 200
        assert sandbox.get_info().state == SandboxState.RUNNING
        assert sandbox.is_running()
    finally:
        try:
            cmd.kill()
        except Exception:
            pass
