from e2b import AsyncSandbox

from e2b.sandbox.filesystem.filesystem import EntryInfo
async def test_write_file(async_sandbox: AsyncSandbox):
    # Attempt to write with empty files array
    empty_info = await async_sandbox.files.write([])
    assert isinstance(empty_info, list)
    assert len(empty_info) == 0

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

    await async_sandbox.files.write([{ "path": filename, "data": initial_content }])
    await async_sandbox.files.write([{ "path": filename, "data": new_content }])
    read_content = await async_sandbox.files.read(filename)
    assert read_content == new_content


async def test_write_to_non_existing_directory(async_sandbox: AsyncSandbox):
    filename = "non_existing_dir/test_write.txt"
    content = "This should succeed too."

    await async_sandbox.files.write([{ "path": filename, "data": content }])
    exists = await async_sandbox.files.exists(filename)
    assert exists

    read_content = await async_sandbox.files.read(filename)
    assert read_content == content
