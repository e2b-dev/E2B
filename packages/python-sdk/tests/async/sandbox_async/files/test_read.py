import pytest

from e2b import (
    AsyncSandbox,
    FileNotFoundException,
    InvalidArgumentException,
    NotFoundException,
)


async def test_read_file(async_sandbox: AsyncSandbox):
    filename = "test_read.txt"
    content = "Hello, world!"

    await async_sandbox.files.write(filename, content)
    read_content = await async_sandbox.files.read(filename)
    assert read_content == content


async def test_read_non_existing_file(async_sandbox: AsyncSandbox):
    filename = "non_existing_file.txt"

    with pytest.raises(FileNotFoundException):
        await async_sandbox.files.read(filename)


async def test_read_non_existing_file_catches_with_deprecated_not_found_exception(
    async_sandbox: AsyncSandbox,
):
    filename = "non_existing_file.txt"

    with pytest.raises(NotFoundException):
        await async_sandbox.files.read(filename)


async def test_read_empty_file(async_sandbox: AsyncSandbox):
    filename = "empty_file.txt"
    content = ""

    await async_sandbox.commands.run(f"touch {filename}")
    read_content = await async_sandbox.files.read(filename)
    assert read_content == content


async def test_read_with_start_and_end(async_sandbox: AsyncSandbox):
    filename = "test_read_range.txt"
    await async_sandbox.files.write(filename, "Hello, world!")
    assert await async_sandbox.files.read(filename, start=7, end=11) == "world"


async def test_read_with_start_only(async_sandbox: AsyncSandbox):
    filename = "test_read_start.txt"
    await async_sandbox.files.write(filename, "Hello, world!")
    assert await async_sandbox.files.read(filename, start=7) == "world!"


async def test_read_with_end_only(async_sandbox: AsyncSandbox):
    filename = "test_read_end.txt"
    await async_sandbox.files.write(filename, "Hello, world!")
    assert await async_sandbox.files.read(filename, end=4) == "Hello"


async def test_read_range_as_bytes(async_sandbox: AsyncSandbox):
    filename = "test_read_range_bytes.txt"
    await async_sandbox.files.write(filename, "Hello, world!")
    sliced = await async_sandbox.files.read(filename, format="bytes", start=7, end=11)
    assert bytes(sliced).decode("utf-8") == "world"


async def test_read_with_invalid_range_rejects(async_sandbox: AsyncSandbox):
    filename = "test_read_invalid_range.txt"
    await async_sandbox.files.write(filename, "data")

    with pytest.raises(InvalidArgumentException):
        await async_sandbox.files.read(filename, start=-1)
    with pytest.raises(InvalidArgumentException):
        await async_sandbox.files.read(filename, start=5, end=2)
