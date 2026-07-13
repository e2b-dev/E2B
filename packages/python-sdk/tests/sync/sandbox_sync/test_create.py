from time import sleep
from typing import Any, cast
from uuid import uuid4

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


@pytest.mark.skip_debug()
def test_mcp_gateway_start_failure_kills_created_sandbox():
    metadata = {"mcp_gateway_cleanup_test_id": str(uuid4())}
    query = SandboxQuery(state=[SandboxState.RUNNING], metadata=metadata)
    remaining_sandboxes = []

    try:
        with pytest.raises(Exception, match="Failed to start MCP gateway"):
            Sandbox.create(
                timeout=60,
                metadata=metadata,
                mcp=cast(Any, {"invalid_server": {}}),
            )

        remaining_sandboxes = Sandbox.list(query=query).next_items()
        assert remaining_sandboxes == []
    finally:
        try:
            remaining_sandboxes = Sandbox.list(query=query).next_items()
        except Exception:
            pass
        for sandbox in remaining_sandboxes:
            Sandbox.kill(sandbox.sandbox_id)


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
def test_filesystem_only_auto_pause_rejects_auto_resume():
    # A filesystem-only auto-pause snapshot can only be resumed explicitly, so
    # combining keep_memory=False with auto_resume is rejected client-side.
    with pytest.raises(InvalidArgumentException):
        Sandbox.create(
            timeout=3,
            lifecycle={
                "on_timeout": {"action": "pause", "keep_memory": False},
                "auto_resume": True,
            },
        )


@pytest.mark.skip_debug()
def test_keep_memory_not_allowed_with_kill():
    # The discriminated union forbids keep_memory on action="kill" at type-check
    # time; the runtime guard rejects it for callers that bypass the type
    # (cast(Any, ...) feeds the deliberately type-invalid input).
    with pytest.raises(InvalidArgumentException):
        Sandbox.create(
            timeout=3,
            lifecycle=cast(
                Any, {"on_timeout": {"action": "kill", "keep_memory": False}}
            ),
        )


@pytest.mark.skip_debug()
def test_invalid_on_timeout_type_does_not_crash(sandbox_factory):
    # An untyped/invalid on_timeout (e.g. None) must not crash create; it falls
    # back to kill semantics like a missing on_timeout (the sandbox just starts).
    sbx = sandbox_factory(timeout=10, lifecycle=cast(Any, {"on_timeout": None}))
    assert sbx.is_running()


@pytest.mark.skip_debug()
def test_keep_memory_none_defaults_to_full_memory(sandbox_factory):
    # An explicit None keep_memory must default to full memory (not filesystem-only):
    # the timeout auto-pause then resumes the SAME sandbox in place (memory restore),
    # so the boot id is unchanged. A changed boot id would mean None was wrongly
    # treated as filesystem-only (cold boot).
    sbx = sandbox_factory(
        timeout=60,
        lifecycle={"on_timeout": {"action": "pause", "keep_memory": None}},
    )
    boot_before = sbx.files.read("/proc/sys/kernel/random/boot_id").strip()

    sbx.set_timeout(0)  # force the timeout auto-pause now
    for _ in range(150):
        if not sbx.is_running():
            break
        sleep(0.2)
    assert not sbx.is_running()

    resumed = sbx.connect()
    assert resumed.sandbox_id == sbx.sandbox_id  # same sandbox
    boot_after = resumed.files.read("/proc/sys/kernel/random/boot_id").strip()
    assert boot_after == boot_before  # memory restore in place, not a cold boot


@pytest.mark.skip_debug()
def test_auto_pause_filesystem_only_reboots(sandbox_factory):
    # keep_memory=False makes the timeout auto-pause filesystem-only, so resuming
    # cold-boots the sandbox from disk.
    sandbox = sandbox_factory(
        timeout=3,
        lifecycle={"on_timeout": {"action": "pause", "keep_memory": False}},
    )

    marker = "auto-pause-fs-only"
    sandbox.files.write("/home/user/auto-pause-marker.txt", marker)
    boot_before = sandbox.files.read("/proc/sys/kernel/random/boot_id").strip()

    sleep(5)

    assert sandbox.get_info().state == SandboxState.PAUSED

    # A filesystem-only snapshot cannot auto-resume on traffic; connect resumes
    # it by cold-booting.
    resumed = sandbox.connect()

    persisted = resumed.files.read("/home/user/auto-pause-marker.txt").strip()
    assert persisted == marker

    boot_after = resumed.files.read("/proc/sys/kernel/random/boot_id").strip()
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
