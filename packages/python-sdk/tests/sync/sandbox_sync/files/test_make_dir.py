def test_make_directory(sandbox):
    dir_name = "test_directory"

    sandbox.files.make_dir(dir_name)
    exists = sandbox.files.exists(dir_name)
    assert exists


def test_make_nested_directory(sandbox):
    nested_dir_name = "test_directory/nested_directory"

    sandbox.files.make_dir(nested_dir_name)
    exists = sandbox.files.exists(nested_dir_name)
    assert exists
