import io
import uuid

from e2b.sandbox.filesystem.filesystem import WriteInfo, WriteEntry


def test_write_text_file(sandbox):
    filename = "test_write.txt"
    content = "This is a test file."

    info = sandbox.files.write(filename, content)
    assert info.path == f"/home/user/{filename}"

    exists = sandbox.files.exists(filename)
    assert exists

    read_content = sandbox.files.read(filename)
    assert read_content == content


def test_write_binary_file(sandbox):
    filename = "test_write.bin"
    text = "This is a test binary file."
    # equivalent to `open("path/to/local/file", "rb")`
    content = io.BytesIO(text.encode("utf-8"))

    info = sandbox.files.write(filename, content)
    assert info.path == f"/home/user/{filename}"

    exists = sandbox.files.exists(filename)
    assert exists

    read_content = sandbox.files.read(filename)
    assert read_content == text


def test_write_multiple_files(sandbox):
    # Attempt to write with empty files array
    empty_info = sandbox.files.write_files([])
    assert isinstance(empty_info, list)
    assert len(empty_info) == 0

    # Attempt to write with no files
    assert sandbox.files.write_files([]) == []

    # Attempt to write with one file in array
    info = sandbox.files.write_files(
        [WriteEntry(path="one_test_file.txt", data="This is a test file.")]
    )
    assert isinstance(info, list)
    assert len(info) == 1
    info = info[0]
    assert isinstance(info, WriteInfo)
    assert info.path == "/home/user/one_test_file.txt"
    exists = sandbox.files.exists(info.path)
    assert exists

    read_content = sandbox.files.read(info.path)
    assert read_content == "This is a test file."

    # Attempt to write with multiple files in array
    files = []
    for i in range(10):
        path = f"test_write_{i}.txt"
        content = f"This is a test file {i}."
        files.append(WriteEntry(path=path, data=content))

    infos = sandbox.files.write_files(files)
    assert isinstance(infos, list)
    assert len(infos) == len(files)
    for i, info in enumerate(infos):
        assert isinstance(info, WriteInfo)
        assert info.path == f"/home/user/test_write_{i}.txt"
        exists = sandbox.files.exists(path)
        assert exists

        read_content = sandbox.files.read(info.path)
        assert read_content == files[i]["data"]


def test_overwrite_file(sandbox):
    filename = "test_overwrite.txt"
    initial_content = "Initial content."
    new_content = "New content."

    sandbox.files.write(filename, initial_content)
    sandbox.files.write(filename, new_content)
    read_content = sandbox.files.read(filename)
    assert read_content == new_content


def test_write_to_non_existing_directory(sandbox):
    filename = "non_existing_dir/test_write.txt"
    content = "This should succeed too."

    sandbox.files.write(filename, content)
    exists = sandbox.files.exists(filename)
    assert exists

    read_content = sandbox.files.read(filename)
    assert read_content == content


def test_write_with_secured_envd(sandbox_factory):
    filename = f"non_existing_dir_{uuid.uuid4()}/test_write.txt"
    content = "This should succeed too."

    sbx = sandbox_factory(timeout=30, secure=True)

    assert sbx.is_running()
    assert sbx._envd_version is not None
    assert sbx._envd_access_token is not None

    sbx.files.write(filename, content)

    exists = sbx.files.exists(filename)
    assert exists

    read_content = sbx.files.read(filename)
    assert read_content == content
