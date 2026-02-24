import pytest

from e2b import AsyncSandbox, InvalidArgumentException, SandboxQuery
from e2b.api.client.models import (
    NewSandbox,
    SandboxAutoResumeConfig,
    SandboxAutoResumePolicy,
)


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


async def test_invalid_lifecycle_raises():
    with pytest.raises(InvalidArgumentException):
        await AsyncSandbox.create(
            lifecycle={"on_timeout": "kill", "auto_resume": True},
        )


def test_lifecycle_auto_resume_policy_mapping():
    from e2b.sandbox_async.sandbox_api import _get_auto_resume_policy

    assert (
        _get_auto_resume_policy({"on_timeout": "pause", "auto_resume": True}) == "any"
    )
    assert (
        _get_auto_resume_policy({"on_timeout": "pause", "auto_resume": False}) == "off"
    )
    assert _get_auto_resume_policy({"on_timeout": "pause"}) == "off"
    assert _get_auto_resume_policy(None) is None


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

    assert body.auto_resume.to_dict() == {"policy": "off"}
