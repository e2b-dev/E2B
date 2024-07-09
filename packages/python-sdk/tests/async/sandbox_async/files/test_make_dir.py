import pytest

from e2b import AsyncSandbox


@pytest.mark.anyio
async def test_make_directory(async_sandbox: AsyncSandbox):
    dir_name = "test_directory"

    await async_sandbox.files.make_dir(dir_name)
    exists = await async_sandbox.files.exists(dir_name)
    assert exists


@pytest.mark.anyio
async def test_make_nested_directory(async_sandbox: AsyncSandbox):
    nested_dir_name = "test_directory/nested_directory"

    await async_sandbox.files.make_dir(nested_dir_name)
    exists = await async_sandbox.files.exists(nested_dir_name)
    assert exists
