import pytest
from e2b import NotFoundException, Sandbox


def test_rename_file(sandbox: Sandbox):
    old_filename = "test_rename_old.txt"
    new_filename = "test_rename_new.txt"
    content = "This file will be renamed."

    sandbox.files.write(old_filename, content)

    info = sandbox.files.rename(old_filename, new_filename)
    assert info.path == f"/home/user/{new_filename}"

    exists_old = sandbox.files.exists(old_filename)
    exists_new = sandbox.files.exists(new_filename)
    assert not exists_old
    assert exists_new
    read_content = sandbox.files.read(new_filename)
    assert read_content == content


def test_rename_non_existing_file(sandbox):
    old_filename = "non_existing_file.txt"
    new_filename = "new_non_existing_file.txt"

    with pytest.raises(NotFoundException):
        sandbox.files.rename(old_filename, new_filename)
