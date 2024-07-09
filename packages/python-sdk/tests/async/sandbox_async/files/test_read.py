import pytest

from e2b import NotFoundException, AsyncSandbox


@pytest.mark.asyncio
async def test_read_file(async_sandbox: AsyncSandbox):
    filename = "test_read.txt"
    content = "Hello, world!"

    await async_sandbox.files.write(filename, content)
    read_content = await async_sandbox.files.read(filename)
    assert read_content == content


@pytest.mark.asyncio
async def test_read_non_existing_file(async_sandbox: AsyncSandbox):
    filename = "non_existing_file.txt"

    with pytest.raises(NotFoundException):
        await async_sandbox.files.read(filename)
