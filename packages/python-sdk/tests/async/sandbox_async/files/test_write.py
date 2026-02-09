import io
import uuid

from e2b import AsyncSandbox
from e2b.sandbox.filesystem.filesystem import WriteEntry
from e2b.sandbox_async.filesystem.filesystem import WriteInfo


async def test_write_text_file(async_sandbox: AsyncSandbox, debug):
    filename = "test_write.txt"
    content = "This is a test file."

    info = await async_sandbox.files.write(filename, content)
    assert info.path == f"/home/user/{filename}"

    exists = await async_sandbox.files.exists(filename)
    assert exists

    read_content = await async_sandbox.files.read(filename)
    assert read_content == content

    if debug:
        await async_sandbox.files.remove(filename)


async def test_write_binary_file(async_sandbox: AsyncSandbox, debug):
    filename = "test_write.bin"
    text = "This is a test binary file."
    # equivalent to `open("path/to/local/file", "rb")`
    content = io.BytesIO(text.encode("utf-8"))

    info = await async_sandbox.files.write(filename, content)
    assert info.path == f"/home/user/{filename}"

    exists = await async_sandbox.files.exists(filename)
    assert exists

    read_content = await async_sandbox.files.read(filename)
    assert read_content == text

    if debug:
        await async_sandbox.files.remove(filename)


async def test_write_multiple_files(async_sandbox: AsyncSandbox, debug):
    num_test_files = 10

    # Attempt to write with empty files array
    empty_info = await async_sandbox.files.write_files([])
    assert isinstance(empty_info, list)
    assert len(empty_info) == 0

    # Attempt to write with one file in array
    one_file_path = "one_test_file.txt"
    info = await async_sandbox.files.write_files(
        [WriteEntry(path=one_file_path, data="This is a test file.")]
    )

    assert isinstance(info, list)
    assert len(info) == 1
    info = info[0]
    assert isinstance(info, WriteInfo)
    assert info.path == "/home/user/one_test_file.txt"
    exists = await async_sandbox.files.exists(info.path)
    assert exists

    read_content = await async_sandbox.files.read(info.path)
    assert read_content == "This is a test file."

    # Attempt to write with multiple files in array
    files = []
    path = ""
    for i in range(num_test_files):
        path = f"test_write_{i}.txt"
        content = f"This is a test file {i}."
        files.append(WriteEntry(path=path, data=content))

    infos = await async_sandbox.files.write_files(files)
    assert isinstance(infos, list)
    assert len(infos) == len(files)
    for i, info in enumerate(infos):
        assert isinstance(info, WriteInfo)
        assert info.path == f"/home/user/test_write_{i}.txt"
        exists = await async_sandbox.files.exists(path)
        assert exists

        read_content = await async_sandbox.files.read(info.path)
        assert read_content == files[i]["data"]

    if debug:
        await async_sandbox.files.remove(one_file_path)
        for i in range(num_test_files):
            await async_sandbox.files.remove(f"test_write_{i}.txt")


async def test_overwrite_file(async_sandbox: AsyncSandbox, debug):
    filename = "test_overwrite.txt"
    initial_content = "Initial content."
    new_content = "New content."

    await async_sandbox.files.write(filename, initial_content)
    await async_sandbox.files.write(filename, new_content)
    read_content = await async_sandbox.files.read(filename)
    assert read_content == new_content

    if debug:
        await async_sandbox.files.remove(filename)


async def test_write_to_non_existing_directory(async_sandbox: AsyncSandbox, debug):
    filename = f"non_existing_dir_{uuid.uuid4()}/test_write.txt"
    content = "This should succeed too."

    await async_sandbox.files.write(filename, content)
    exists = await async_sandbox.files.exists(filename)
    assert exists

    read_content = await async_sandbox.files.read(filename)
    assert read_content == content

    if debug:
        await async_sandbox.files.remove(filename)


async def test_write_with_secured_envd(async_sandbox_factory):
    filename = f"non_existing_dir_{uuid.uuid4()}/test_write.txt"
    content = "This should succeed too."

    sbx = await async_sandbox_factory(timeout=30, secure=True)

    assert await sbx.is_running()
    assert sbx._envd_version is not None
    assert sbx._envd_access_token is not None

    await sbx.files.write(filename, content)

    exists = await sbx.files.exists(filename)
    assert exists

    read_content = await sbx.files.read(filename)
    assert read_content == content


async def test_write_files_with_different_data_types(
    async_sandbox: AsyncSandbox, debug
):
    text_data = "Text string data"
    bytes_data = b"Bytes data"
    bytes_io_data = io.BytesIO(b"BytesIO data")
    string_io_data = io.StringIO("StringIO data")

    files = [
        WriteEntry(path="writefiles_text.txt", data=text_data),
        WriteEntry(path="writefiles_bytes.bin", data=bytes_data),
        WriteEntry(path="writefiles_bytesio.bin", data=bytes_io_data),
        WriteEntry(path="writefiles_stringio.txt", data=string_io_data),
    ]

    infos = await async_sandbox.files.write_files(files)

    assert len(infos) == 4

    text_content = await async_sandbox.files.read("writefiles_text.txt")
    assert text_content == text_data

    bytes_content = await async_sandbox.files.read("writefiles_bytes.bin")
    assert bytes_content == "Bytes data"

    bytes_io_content = await async_sandbox.files.read("writefiles_bytesio.bin")
    assert bytes_io_content == "BytesIO data"

    string_io_content = await async_sandbox.files.read("writefiles_stringio.txt")
    assert string_io_content == "StringIO data"

    if debug:
        for file in files:
            await async_sandbox.files.remove(file["path"])
