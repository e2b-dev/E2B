import pytest

from e2b import InvalidArgumentException, Sandbox
from e2b.api.client.models import LifecycleConfig, NewSandbox
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
            lifecycle={"on_timeout": "kill", "resume_on": "any"},
        )


def test_create_payload_serializes_lifecycle():
    body = NewSandbox(
        template_id="template-id",
        auto_pause=True,
        lifecycle=LifecycleConfig(on_timeout="kill", resume_on="any"),
    )

    assert body.to_dict()["autoPause"] is True
    assert body.to_dict()["lifecycle"] == {"onTimeout": "kill", "resumeOn": "any"}


def test_create_payload_deserializes_lifecycle():
    body = NewSandbox.from_dict(
        {
            "templateID": "template-id",
            "autoPause": False,
            "lifecycle": {"onTimeout": "pause", "resumeOn": "off"},
        }
    )

    assert isinstance(body.lifecycle, LifecycleConfig)
    assert body.lifecycle.on_timeout == "pause"
    assert body.lifecycle.resume_on == "off"
