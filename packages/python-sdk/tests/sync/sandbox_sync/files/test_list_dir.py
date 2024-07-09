from e2b import Sandbox, FileType


def test_list_directory(sandbox: Sandbox):
    dir_name = "test_directory"

    sandbox.files.make_dir(dir_name)
    files = sandbox.files.list(dir_name)
    assert len(files) == 0

    sandbox.files.write(f"{dir_name}/test_file", "test")
    files1 = sandbox.files.list(dir_name)
    assert len(files1) == 1
    assert files1[0].name == "test_file"
    assert files1[0].type == FileType.FILE
