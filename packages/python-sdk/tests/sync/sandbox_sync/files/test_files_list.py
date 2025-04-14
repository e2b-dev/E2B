import uuid

from e2b import Sandbox, FileType


def test_list_directory(sandbox: Sandbox):
    parent_dir_name = f"test_directory_{uuid.uuid4()}"

    sandbox.files.make_dir(parent_dir_name)
    sandbox.files.make_dir(f"{parent_dir_name}/subdir1")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir2")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir1/subdir1_1")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir1/subdir1_2")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir2/subdir2_1")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir2/subdir2_2")

    # explicit depth 0 (should default to 1)
    files0 = sandbox.files.list(parent_dir_name, depth=0)
    assert len(files0) == 2
    assert files0[0].name == "subdir1"
    assert files0[1].name == "subdir2"

    # default depth (1)
    files = sandbox.files.list(parent_dir_name)
    assert len(files) == 2
    assert files[0].name == "subdir1"
    assert files[1].name == "subdir2"

    # explicit depth 1
    files1 = sandbox.files.list(parent_dir_name, depth=1)
    assert len(files1) == 2
    assert files1[0].name == "subdir1"
    assert files1[1].name == "subdir2"

    # explicit depth 2
    files2 = sandbox.files.list(parent_dir_name, depth=2)
    assert len(files2) == 6
    assert files2[0].name == "subdir1"
    assert files2[1].name == "subdir1_1"
    assert files2[2].name == "subdir1_2"
    assert files2[3].name == "subdir2"
    assert files2[4].name == "subdir2_1"
    assert files2[5].name == "subdir2_2"

    # explicit depth 3 (should be the same as depth 2)
    files3 = sandbox.files.list(parent_dir_name, depth=3)
    assert len(files3) == 6
    assert files3[0].name == "subdir1"
    assert files3[1].name == "subdir1_1"
    assert files3[2].name == "subdir1_2"
    assert files3[3].name == "subdir2"
    assert files3[4].name == "subdir2_1"
    assert files3[5].name == "subdir2_2"

    # Cleanup
    sandbox.files.remove(parent_dir_name)
