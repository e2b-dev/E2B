from e2b import AsyncSandbox


async def test_remove_file(async_sandbox: AsyncSandbox):
    filename = "test_remove.txt"
    content = "This file will be removed."

    await async_sandbox.files.write(filename, content)

    await async_sandbox.files.remove(filename)

    exists = await async_sandbox.files.exists(filename)
    assert not exists


async def test_remove_non_existing_file(async_sandbox: AsyncSandbox):
    filename = "non_existing_file.txt"
    await async_sandbox.files.remove(filename)
