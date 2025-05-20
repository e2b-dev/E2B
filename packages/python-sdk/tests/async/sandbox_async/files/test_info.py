import pytest
from e2b.exceptions import NotFoundException
from e2b import AsyncSandbox, FileType


@pytest.mark.asyncio
async def test_get_info_of_file(async_sandbox: AsyncSandbox):
    filename = "test_file.txt"

    await async_sandbox.files.write(filename, "test")
    info = await async_sandbox.files.get_info(filename)
    current_path = await async_sandbox.commands.run("pwd")

    assert info.name == filename
    assert info.type == FileType.FILE
    assert info.path == f"{current_path.stdout.strip()}/{filename}"
    assert info.size == 4
    assert info.mode == 0o644
    assert info.permissions == "-rw-r--r--"
    assert info.owner == "user"
    assert info.group == "user"
    assert info.modified_time is not None


@pytest.mark.asyncio
async def test_get_info_of_nonexistent_file(async_sandbox: AsyncSandbox):
    filename = "test_does_not_exist.txt"

    with pytest.raises(NotFoundException) as exc_info:
        await async_sandbox.files.get_info(filename)


@pytest.mark.asyncio
async def test_get_info_of_directory(async_sandbox: AsyncSandbox):
    dirname = "test_dir"

    await async_sandbox.files.make_dir(dirname)
    info = await async_sandbox.files.get_info(dirname)
    current_path = await async_sandbox.commands.run("pwd")

    assert info.name == dirname
    assert info.type == FileType.DIR
    assert info.path == f"{current_path.stdout.strip()}/{dirname}"
    assert info.size == 0
    assert info.mode == 0o755
    assert info.permissions == "drwxr-xr-x"
    assert info.owner == "user"
    assert info.group == "user"
    assert info.modified_time is not None


@pytest.mark.asyncio
async def test_get_info_of_nonexistent_directory(async_sandbox: AsyncSandbox):
    dirname = "test_does_not_exist_dir"

    with pytest.raises(NotFoundException) as exc_info:
        await async_sandbox.files.get_info(dirname)
