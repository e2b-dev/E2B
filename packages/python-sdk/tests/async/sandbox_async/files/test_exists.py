from connectrpc.code import Code
from connectrpc.errors import ConnectError

from e2b import AsyncSandbox, FileNotFoundException
from e2b.sandbox_async.filesystem.filesystem import _handle_filesystem_rpc_exception


async def test_exists(async_sandbox: AsyncSandbox):
    filename = "test_exists.txt"

    await async_sandbox.files.write(filename, "test")
    assert await async_sandbox.files.exists(filename)


async def test_exists_non_existing_file(async_sandbox: AsyncSandbox):
    assert not await async_sandbox.files.exists("non_existing_file.txt")


def test_unknown_enoent_maps_to_file_not_found():
    err = ConnectError(Code.UNKNOWN, "open /tmp/file: No such file or directory")

    mapped = _handle_filesystem_rpc_exception(err)

    assert isinstance(mapped, FileNotFoundException)


def test_not_found_maps_to_file_not_found():
    err = ConnectError(Code.NOT_FOUND, "file not found")

    mapped = _handle_filesystem_rpc_exception(err)

    assert isinstance(mapped, FileNotFoundException)
