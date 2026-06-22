import pytest

from e2b import FileNotFoundException, NotFoundException, AsyncSandbox


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


async def test_read_file_as_stream(async_sandbox: AsyncSandbox):
    filename = "test_read_stream.txt"
    content = "Streamed read content. " * 10_000

    await async_sandbox.files.write(filename, content)
    stream = await async_sandbox.files.read(filename, format="stream")
    chunks = []
    async for chunk in stream:
        chunks.append(chunk)
    read_content = b"".join(chunks).decode("utf-8")
    assert read_content == content


async def test_read_file_as_stream_with_gzip(async_sandbox: AsyncSandbox):
    filename = "test_read_stream_gzip.txt"
    content = "Streamed gzipped read content. " * 10_000

    await async_sandbox.files.write(filename, content)
    stream = await async_sandbox.files.read(filename, format="stream", gzip=True)
    chunks = []
    async for chunk in stream:
        chunks.append(chunk)
    read_content = b"".join(chunks).decode("utf-8")
    assert read_content == content


async def test_read_non_existing_file_as_stream(async_sandbox: AsyncSandbox):
    filename = "non_existing_file.txt"

    with pytest.raises(FileNotFoundException):
        await async_sandbox.files.read(filename, format="stream")


async def test_read_file_as_stream_context_manager(async_sandbox: AsyncSandbox):
    filename = "test_read_stream_ctx.txt"
    content = "Streamed read content. " * 10_000

    await async_sandbox.files.write(filename, content)
    chunks = []
    async with await async_sandbox.files.read(filename, format="stream") as stream:
        async for chunk in stream:
            chunks.append(chunk)
    read_content = b"".join(chunks).decode("utf-8")
    assert read_content == content


async def test_read_file_as_stream_partial_then_close(async_sandbox: AsyncSandbox):
    filename = "test_read_stream_partial.txt"
    content = "Streamed read content. " * 10_000

    await async_sandbox.files.write(filename, content)
    # Reading only the first chunk and closing must not raise or leak.
    stream = await async_sandbox.files.read(filename, format="stream")
    first = await stream.__anext__()
    assert len(first) > 0
    await stream.aclose()
