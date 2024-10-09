from e2b.sandbox.filesystem.filesystem import EntryInfo

def test_write_file(sandbox):
    filename = "test_write.txt"
    content = "This is a test file."

    # Attempt to write without path
    try:
        sandbox.files.write(None, content)
    except Exception as e:
        assert "object is not iterable" in str(e)

    info = sandbox.files.write(filename, content)
    assert info.path == f"/home/user/{filename}"

    exists = sandbox.files.exists(filename)
    assert exists

    read_content = sandbox.files.read(filename)
    assert read_content == content

def test_write_multiple_files(sandbox):
    # Attempt to write with empty files array
    empty_info = sandbox.files.write([])
    assert isinstance(empty_info, list)
    assert len(empty_info) == 0

    # Attempt to write with None path and empty files array
    try:
        sandbox.files.write(None, [])
    except Exception as e:
        assert "object is not iterable" in str(e)

    # Attempt to write with path and file array
    try:
        sandbox.files.write("/path/to/file", [{ "path": "one_test_file.txt", "data": "This is a test file." }])
    except Exception as e:
        assert "Cannot specify path with array of files" in str(e)

    # Attempt to write with one file in array
    info = sandbox.files.write([{ "path": "one_test_file.txt", "data": "This is a test file." }])
    assert isinstance(info, list)
    assert len(info) == 1
    info = info[0]
    assert isinstance(info, EntryInfo)
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
        files.append({"path": path, "data": content})

    infos = sandbox.files.write(files)
    assert isinstance(infos, list)
    assert len(infos) == len(files)
    for i, info in enumerate(infos):
        assert isinstance(info, EntryInfo)
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
