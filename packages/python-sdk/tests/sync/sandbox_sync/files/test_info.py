import pytest
from e2b.exceptions import NotFoundException
from e2b import Sandbox, FileType


def test_get_info_of_file(sandbox: Sandbox):
    filename = "test_file.txt"

    sandbox.files.write(filename, "test")
    info = sandbox.files.get_info(filename)
    current_path = sandbox.commands.run("pwd")

    assert info.name == filename
    assert info.type == FileType.FILE
    assert info.path == f"{current_path.stdout.strip()}/{filename}"
    assert info.size == 4
    assert info.mode == 0o644
    assert info.permissions == "-rw-r--r--"
    assert info.owner == "user"
    assert info.group == "user"
    assert info.modified_time is not None


def test_get_info_of_nonexistent_file(sandbox: Sandbox):
    filename = "test_does_not_exist.txt"

    with pytest.raises(NotFoundException):
        sandbox.files.get_info(filename)


def test_get_info_of_directory(sandbox: Sandbox):
    dirname = "test_dir"

    sandbox.files.make_dir(dirname)
    info = sandbox.files.get_info(dirname)
    current_path = sandbox.commands.run("pwd")

    assert info.name == dirname
    assert info.type == FileType.DIR
    assert info.path == f"{current_path.stdout.strip()}/{dirname}"
    assert info.size > 0
    assert info.mode == 0o755
    assert info.permissions == "drwxr-xr-x"
    assert info.owner == "user"
    assert info.group == "user"
    assert info.modified_time is not None


def test_get_info_of_nonexistent_directory(sandbox: Sandbox):
    dirname = "test_does_not_exist_dir"

    with pytest.raises(NotFoundException):
        sandbox.files.get_info(dirname)


def test_file_symlink(sandbox: Sandbox):
    test_dir = "test-simlink-entry"
    file_name = "test.txt"
    content = "Hello, World!"

    sandbox.files.make_dir(test_dir)
    sandbox.files.write(f"{test_dir}/{file_name}", content)

    symlink_name = "symlink_to_test.txt"
    sandbox.commands.run(f"ln -s {file_name} {symlink_name}", cwd=test_dir)

    file = sandbox.files.get_info(f"{test_dir}/{symlink_name}")

    pwd = sandbox.commands.run("pwd")
    assert file.type == FileType.FILE
    assert file.symlink_target == f"{pwd.stdout.strip()}/{test_dir}/{file_name}"

    sandbox.files.remove(test_dir)
