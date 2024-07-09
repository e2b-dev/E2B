import pytest

from e2b import AsyncSandbox, FileType


@pytest.mark.anyio
async def test_list_directory(async_sandbox: AsyncSandbox):
    dir_name = "test_directory"

    await async_sandbox.files.make_dir(dir_name)
    files = await async_sandbox.files.list(dir_name)
    assert len(files) == 0

    await async_sandbox.files.write(f"{dir_name}/test_file", "test")
    files1 = await async_sandbox.files.list(dir_name)
    assert len(files1) == 1
    assert files1[0].name == "test_file"
    assert files1[0].type == FileType.FILE
