import pytest

from e2b import InvalidArgumentException, Sandbox
from e2b.api.client.models import NewSandbox
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


def test_invalid_lifecycle_raises():
    with pytest.raises(InvalidArgumentException):
        Sandbox.create(
            lifecycle={"on_timeout": "kill", "auto_resume": True},
        )


def test_lifecycle_auto_resume_policy_mapping():
    from e2b.sandbox_sync.sandbox_api import _get_auto_resume_policy

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
    )
    body["autoResume"] = {"policy": "any"}

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
