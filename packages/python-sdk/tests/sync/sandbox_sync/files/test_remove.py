def test_remove_file(sandbox):
    filename = "test_remove.txt"
    content = "This file will be removed."

    sandbox.files.write(filename, content)
    sandbox.files.remove(filename)
    exists = sandbox.files.exists(filename)
    assert not exists


def test_remove_non_existing_file(sandbox):
    filename = "non_existing_file.txt"
    sandbox.files.remove(filename)
