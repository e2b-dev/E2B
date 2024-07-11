import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
@pytest.mark.asyncio
async def test_start(template):
    sbx = await AsyncSandbox.create(template, timeout=5)
    try:
        assert await sbx.is_running()
    finally:
        await sbx.kill()


@pytest.mark.skip_debug()
@pytest.mark.asyncio
async def test_metadata(template):
    sbx = await AsyncSandbox.create(
        template, timeout=5, metadata={"test-key": "test-value"}
    )

    try:
        sbxs = await AsyncSandbox.list()

        for sbx_info in sbxs:
            if sbx.sandbox_id == sbx_info.sandbox_id:
                assert sbx_info.metadata is not None
                assert sbx_info.metadata["test-key"] == "test-value"
                break
        else:
            assert False, "Sandbox not found"
    finally:
        await sbx.kill()
