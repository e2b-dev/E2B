from connectrpc.code import Code
from connectrpc.errors import ConnectError

from e2b import FileNotFoundException, Sandbox
from e2b.sandbox_sync.filesystem.filesystem import _handle_filesystem_rpc_exception


def test_exists(sandbox: Sandbox):
    filename = "test_exists.txt"

    sandbox.files.write(filename, "test")
    assert sandbox.files.exists(filename)


def test_exists_non_existing_file(sandbox: Sandbox):
    assert not sandbox.files.exists("non_existing_file.txt")


def test_unknown_enoent_maps_to_file_not_found():
    err = ConnectError(Code.UNKNOWN, "open /tmp/file: No such file or directory")

    mapped = _handle_filesystem_rpc_exception(err)

    assert isinstance(mapped, FileNotFoundException)
