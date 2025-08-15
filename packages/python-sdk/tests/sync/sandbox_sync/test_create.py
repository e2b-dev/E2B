import pytest

from e2b import Sandbox
from e2b.sandbox.sandbox_api import SandboxQuery


@pytest.mark.skip_debug()
def test_start(template):
    sbx = Sandbox.create(template, timeout=5)
    try:
        assert sbx.is_running()
        assert sbx._envd_version is not None
    finally:
        sbx.kill()


@pytest.mark.skip_debug()
def test_metadata(template):
    sbx = Sandbox.create(template, timeout=5, metadata={"test-key": "test-value"})

    try:
        paginator = Sandbox.list(
            query=SandboxQuery(metadata={"test-key": "test-value"})
        )
        sandboxes = paginator.next_items()

        for sbx_info in sandboxes:
            if sbx.sandbox_id == sbx_info.sandbox_id:
                assert sbx_info.metadata is not None
                assert sbx_info.metadata["test-key"] == "test-value"
                break
        else:
            assert False, "Sandbox not found"
    finally:
        sbx.kill()
