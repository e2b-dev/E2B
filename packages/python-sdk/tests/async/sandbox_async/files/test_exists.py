import pytest

from e2b import AsyncSandbox


@pytest.mark.asyncio
async def test_exists(async_sandbox: AsyncSandbox):
    filename = "test_exists.txt"

    await async_sandbox.files.write(filename, "test")
    assert await async_sandbox.files.exists(filename)