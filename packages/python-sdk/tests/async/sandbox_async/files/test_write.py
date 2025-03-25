import io

from e2b import AsyncSandbox
from e2b.sandbox_async.filesystem.filesystem import EntryInfo

async def test_write_text_file(async_sandbox: AsyncSandbox):
    filename = "test_write.txt"
    content = "This is a test file."

    # Attempt to write without path
    try:
        await async_sandbox.files.write(None, content)
    except Exception as e:
        assert "Path or files are required" in str(e)

    info = await async_sandbox.files.write(filename, content)
    assert info.path == f"/home/user/{filename}"

    exists = await async_sandbox.files.exists(filename)
    assert exists

    read_content = await async_sandbox.files.read(filename)
    assert read_content == content

async def test_write_binary_file(async_sandbox: AsyncSandbox):
    filename = "test_write.txt"
    text = "This is a test binary file."
    # equivalent to `open("path/to/local/file", "rb")`
    content = io.BytesIO(text.encode('utf-8'))

    info = await async_sandbox.files.write(filename, content)
    assert info.path == f"/home/user/{filename}"

    exists = await async_sandbox.files.exists(filename)
    assert exists

    read_content = await async_sandbox.files.read(filename)
    assert read_content == text

async def test_write_multiple_files(async_sandbox: AsyncSandbox):
    # Attempt to write with empty files array
    empty_info = await async_sandbox.files.write([])
    assert isinstance(empty_info, list)
    assert len(empty_info) == 0

    # Attempt to write with None path and empty files array
    try:
        await async_sandbox.files.write(None, [])
    except Exception as e:
        assert "Path or files are required" in str(e)

    # Attempt to write with path and file array
    try:
        await async_sandbox.files.write("/path/to/file", [{ "path": "one_test_file.txt", "data": "This is a test file." }])
    except Exception as e:
        assert "Cannot specify both path and array of files. You have to specify either path and data for a single file or an array for multiple files." in str(e)

    # Attempt to write with one file in array
    info = await async_sandbox.files.write([{ "path": "one_test_file.txt", "data": "This is a test file." }])
    assert isinstance(info, list)
    assert len(info) == 1
    info = info[0]
    assert isinstance(info, EntryInfo)
    assert info.path == "/home/user/one_test_file.txt"
    exists = await async_sandbox.files.exists(info.path)
    assert exists

    read_content = await async_sandbox.files.read(info.path)
    assert read_content == "This is a test file."

    # Attempt to write with multiple files in array
    files = []
    for i in range(10):
        path = f"test_write_{i}.txt"
        content = f"This is a test file {i}."
        files.append({"path": path, "data": content})

    infos = await async_sandbox.files.write(files)
    assert isinstance(infos, list)
    assert len(infos) == len(files)
    for i, info in enumerate(infos):
        assert isinstance(info, EntryInfo)
        assert info.path == f"/home/user/test_write_{i}.txt"
        exists = await async_sandbox.files.exists(path)
        assert exists

        read_content = await async_sandbox.files.read(info.path)
        assert read_content == files[i]["data"]

async def test_overwrite_file(async_sandbox: AsyncSandbox):
    filename = "test_overwrite.txt"
    initial_content = "Initial content."
    new_content = "New content."

    await async_sandbox.files.write(filename, initial_content)
    await async_sandbox.files.write(filename, new_content)
    read_content = await async_sandbox.files.read(filename)
    assert read_content == new_content


async def test_write_to_non_existing_directory(async_sandbox: AsyncSandbox):
    filename = "non_existing_dir/test_write.txt"
    content = "This should succeed too."

    await async_sandbox.files.write(filename, content)
    exists = await async_sandbox.files.exists(filename)
    assert exists

    read_content = await async_sandbox.files.read(filename)
    assert read_content == content
