from e2b.sandbox.filesystem.filesystem import EntryInfo

def test_write_file(sandbox):
    # Attempt to write with empty files array
    empty_info = sandbox.files.write([])
    assert isinstance(empty_info, list)
    assert len(empty_info) == 0

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

    sandbox.files.write([{ "path": filename, "data": initial_content }])
    sandbox.files.write([{ "path": filename, "data": new_content }])
    read_content = sandbox.files.read(filename)
    assert read_content == new_content


def test_write_to_non_existing_directory(sandbox):
    filename = "non_existing_dir/test_write.txt"
    content = "This should succeed too."

    sandbox.files.write([{ "path": filename, "data": content }])
    exists = sandbox.files.exists(filename)
    assert exists

    read_content = sandbox.files.read(filename)
    assert read_content == content
