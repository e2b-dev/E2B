import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_start(template):
    sbx = Sandbox(template, timeout=5)
    try:
        assert sbx.is_running()
    finally:
        sbx.kill()


@pytest.mark.skip_debug()
def test_metadata(template):
    sbx = Sandbox(template, timeout=5, metadata={"test-key": "test-value"})

    try:
        sbxs = Sandbox.list()

        for sbx_info in sbxs:
            if sbx.sandbox_id == sbx_info.sandbox_id:
                assert sbx_info.metadata is not None
                assert sbx_info.metadata["test-key"] == "test-value"
                break
        else:
            assert False, "Sandbox not found"
    finally:
        sbx.kill()
