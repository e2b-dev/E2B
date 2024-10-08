import pytest

from e2b import NotFoundException, AsyncSandbox


async def test_read_file(async_sandbox: AsyncSandbox):
    filename = "test_read.txt"
    content = "Hello, world!"

    await async_sandbox.files.write(filename, content)
    read_content = await async_sandbox.files.read(filename)
    assert read_content == content


async def test_read_non_existing_file(async_sandbox: AsyncSandbox):
    filename = "non_existing_file.txt"

    with pytest.raises(NotFoundException):
        await async_sandbox.files.read(filename)


async def test_read_empty_file(async_sandbox: AsyncSandbox):
    filename = "empty_file.txt"
    content = ""

    await async_sandbox.commands.run(f"touch {filename}")
    read_content = await async_sandbox.files.read(filename)
    assert read_content == content
