import uuid

from e2b import AsyncSandbox


async def test_make_directory(async_sandbox: AsyncSandbox):
    dir_name = f"test_directory_{uuid.uuid4()}"

    await async_sandbox.files.make_dir(dir_name)
    exists = await async_sandbox.files.exists(dir_name)
    assert exists


async def test_make_directory_already_exists(async_sandbox: AsyncSandbox):
    dir_name = f"test_directory_{uuid.uuid4()}"

    created = await async_sandbox.files.make_dir(dir_name)
    assert created

    created = await async_sandbox.files.make_dir(dir_name)
    assert not created


async def test_make_nested_directory(async_sandbox: AsyncSandbox):
    nested_dir_name = f"test_directory_{uuid.uuid4()}/nested_directory"

    await async_sandbox.files.make_dir(nested_dir_name)
    exists = await async_sandbox.files.exists(nested_dir_name)
    assert exists
