from e2b import AsyncSandbox
from e2b.sandbox.filesystem.filesystem import WriteEntry


async def test_write_and_read_with_gzip(async_sandbox: AsyncSandbox, debug):
    filename = "test_gzip_write.txt"
    content = "This is a test file with gzip encoding."

    info = await async_sandbox.files.write(filename, content, content_encoding="gzip")
    assert info.path == f"/home/user/{filename}"

    read_content = await async_sandbox.files.read(filename, content_encoding="gzip")
    assert read_content == content

    if debug:
        await async_sandbox.files.remove(filename)


async def test_write_gzip_read_plain(async_sandbox: AsyncSandbox, debug):
    filename = "test_gzip_write_plain_read.txt"
    content = "Written with gzip, read without."

    await async_sandbox.files.write(filename, content, content_encoding="gzip")

    read_content = await async_sandbox.files.read(filename)
    assert read_content == content

    if debug:
        await async_sandbox.files.remove(filename)


async def test_write_files_with_gzip(async_sandbox: AsyncSandbox, debug):
    files = [
        WriteEntry(path="gzip_multi_1.txt", data="File 1 content"),
        WriteEntry(path="gzip_multi_2.txt", data="File 2 content"),
        WriteEntry(path="gzip_multi_3.txt", data="File 3 content"),
    ]

    infos = await async_sandbox.files.write_files(files, content_encoding="gzip")
    assert len(infos) == len(files)

    for file in files:
        read_content = await async_sandbox.files.read(file["path"])
        assert read_content == file["data"]

    if debug:
        for file in files:
            await async_sandbox.files.remove(file["path"])


async def test_read_bytes_with_gzip(async_sandbox: AsyncSandbox, debug):
    filename = "test_gzip_bytes.txt"
    content = "Binary content with gzip."

    await async_sandbox.files.write(filename, content)

    read_bytes = await async_sandbox.files.read(
        filename, format="bytes", content_encoding="gzip"
    )
    assert isinstance(read_bytes, bytes)
    assert read_bytes.decode("utf-8") == content

    if debug:
        await async_sandbox.files.remove(filename)
