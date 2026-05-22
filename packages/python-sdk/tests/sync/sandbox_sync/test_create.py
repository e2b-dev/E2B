from time import sleep

import httpx
import pytest

from e2b import Sandbox, SandboxState
from e2b.api.client.models import (
    NewSandbox,
    SandboxAutoResumeConfig,
)
from e2b.sandbox.sandbox_api import SandboxQuery, get_auto_resume_enabled


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
