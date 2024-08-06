def test_write_file(sandbox):
    filename = "test_write.txt"
    content = "This is a test file."

    info = sandbox.files.write(filename, content)
    assert info.path == f"/home/user/{filename}"

    exists = sandbox.files.exists(filename)
    assert exists

    read_content = sandbox.files.read(filename)
    assert read_content == content


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
