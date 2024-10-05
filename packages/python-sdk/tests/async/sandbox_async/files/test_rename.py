import pytest

from e2b import NotFoundException, AsyncSandbox


async def test_rename_file(async_sandbox: AsyncSandbox):
    old_filename = "test_rename_old.txt"
    new_filename = "test_rename_new.txt"
    content = "This file will be renamed."

    await async_sandbox.files.write(old_filename, content)
    info = await async_sandbox.files.rename(old_filename, new_filename)
    assert info.path == f"/home/user/{new_filename}"

    exists_old = await async_sandbox.files.exists(old_filename)
    exists_new = await async_sandbox.files.exists(new_filename)
    assert not exists_old
    assert exists_new

    read_content = await async_sandbox.files.read(new_filename)
    assert read_content == content


async def test_rename_non_existing_file(async_sandbox: AsyncSandbox):
    old_filename = "non_existing_file.txt"
    new_filename = "new_non_existing_file.txt"

    with pytest.raises(NotFoundException):
        await async_sandbox.files.rename(old_filename, new_filename)
