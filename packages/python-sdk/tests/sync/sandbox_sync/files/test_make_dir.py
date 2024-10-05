import uuid

from e2b import Sandbox


def test_make_directory(sandbox: Sandbox):
    dir_name = f"test_directory_{uuid.uuid4()}"

    sandbox.files.make_dir(dir_name)
    exists = sandbox.files.exists(dir_name)
    assert exists


async def test_make_directory_already_exists(sandbox: Sandbox):
    dir_name = f"test_directory_{uuid.uuid4()}"

    created = sandbox.files.make_dir(dir_name)
    assert created

    created = sandbox.files.make_dir(dir_name)
    assert not created


def test_make_nested_directory(sandbox: Sandbox):
    nested_dir_name = f"test_directory_{uuid.uuid4()}/nested_directory"

    sandbox.files.make_dir(nested_dir_name)
    exists = sandbox.files.exists(nested_dir_name)
    assert exists
