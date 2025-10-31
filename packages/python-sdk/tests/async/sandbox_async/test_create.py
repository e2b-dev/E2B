import pytest

from e2b import AsyncSandbox, SandboxQuery


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
