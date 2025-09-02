import uuid

from e2b import AsyncSandbox, FileType


async def test_list_directory(async_sandbox: AsyncSandbox):
    home_dir_name = "/home/user"
    parent_dir_name = f"test_directory_{uuid.uuid4()}"

    await async_sandbox.files.make_dir(parent_dir_name)
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir1")
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir2")
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir1/subdir1_1")
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir1/subdir1_2")
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir2/subdir2_1")
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir2/subdir2_2")
    await async_sandbox.files.write(f"{parent_dir_name}/file1.txt", "Hello, world!")

    test_cases = [
        {
            "name": "default depth (1)",
            "depth": None,
            "expected_len": 3,
            "expected_file_names": [
                "file1.txt",
                "subdir1",
                "subdir2",
            ],
            "expected_file_types": [
                FileType.FILE,
                FileType.DIR,
                FileType.DIR,
            ],
            "expected_file_paths": [
                f"{home_dir_name}/{parent_dir_name}/file1.txt",
                f"{home_dir_name}/{parent_dir_name}/subdir1",
                f"{home_dir_name}/{parent_dir_name}/subdir2",
            ],
        },
        {
            "name": "explicit depth 1",
            "depth": 1,
            "expected_len": 3,
            "expected_file_names": [
                "file1.txt",
                "subdir1",
                "subdir2",
            ],
            "expected_file_types": [
                FileType.FILE,
                FileType.DIR,
                FileType.DIR,
            ],
            "expected_file_paths": [
                f"{home_dir_name}/{parent_dir_name}/file1.txt",
                f"{home_dir_name}/{parent_dir_name}/subdir1",
                f"{home_dir_name}/{parent_dir_name}/subdir2",
            ],
        },
        {
            "name": "explicit depth 2",
            "depth": 2,
            "expected_len": 7,
            "expected_file_types": [
                FileType.FILE,
                FileType.DIR,
                FileType.DIR,
                FileType.DIR,
                FileType.DIR,
                FileType.DIR,
                FileType.DIR,
            ],
            "expected_file_names": [
                "file1.txt",
                "subdir1",
                "subdir1_1",
                "subdir1_2",
                "subdir2",
                "subdir2_1",
                "subdir2_2",
            ],
            "expected_file_paths": [
                f"{home_dir_name}/{parent_dir_name}/file1.txt",
                f"{home_dir_name}/{parent_dir_name}/subdir1",
                f"{home_dir_name}/{parent_dir_name}/subdir1/subdir1_1",
                f"{home_dir_name}/{parent_dir_name}/subdir1/subdir1_2",
                f"{home_dir_name}/{parent_dir_name}/subdir2",
                f"{home_dir_name}/{parent_dir_name}/subdir2/subdir2_1",
                f"{home_dir_name}/{parent_dir_name}/subdir2/subdir2_2",
            ],
        },
        {
            "name": "explicit depth 3 (should be the same as depth 2)",
            "depth": 3,
            "expected_len": 7,
            "expected_file_names": [
                "file1.txt",
                "subdir1",
                "subdir1_1",
                "subdir1_2",
                "subdir2",
                "subdir2_1",
                "subdir2_2",
            ],
            "expected_file_types": [
                FileType.FILE,
                FileType.DIR,
                FileType.DIR,
                FileType.DIR,
                FileType.DIR,
                FileType.DIR,
                FileType.DIR,
            ],
            "expected_file_paths": [
                f"{home_dir_name}/{parent_dir_name}/file1.txt",
                f"{home_dir_name}/{parent_dir_name}/subdir1",
                f"{home_dir_name}/{parent_dir_name}/subdir1/subdir1_1",
                f"{home_dir_name}/{parent_dir_name}/subdir1/subdir1_2",
                f"{home_dir_name}/{parent_dir_name}/subdir2",
                f"{home_dir_name}/{parent_dir_name}/subdir2/subdir2_1",
                f"{home_dir_name}/{parent_dir_name}/subdir2/subdir2_2",
            ],
        },
    ]

    for test_case in test_cases:
        files = await async_sandbox.files.list(
            parent_dir_name,
            depth=test_case["depth"] if test_case["depth"] is not None else None,
        )

        assert len(files) == test_case["expected_len"]

        for i in range(len(test_case["expected_file_names"])):
            assert files[i].name == test_case["expected_file_names"][i]
            assert files[i].path == test_case["expected_file_paths"][i]
            assert files[i].type == test_case["expected_file_types"][i]

    await async_sandbox.files.remove(parent_dir_name)


async def test_list_directory_error_cases(async_sandbox: AsyncSandbox):
    parent_dir_name = f"test_directory_{uuid.uuid4()}"
    await async_sandbox.files.make_dir(parent_dir_name)

    expected_error_message = "depth should be at least 1"
    try:
        await async_sandbox.files.list(parent_dir_name, depth=-1)
        assert False, "Expected error but none was thrown"
    except Exception as err:
        assert expected_error_message in str(err), (
            f'expected error message to include "{expected_error_message}"'
        )

    await async_sandbox.files.remove(parent_dir_name)


async def test_file_entry_details(async_sandbox: AsyncSandbox):
    test_dir = "test-file-entry"
    file_path = f"{test_dir}/test.txt"
    content = "Hello, World!"

    await async_sandbox.files.make_dir(test_dir)
    await async_sandbox.files.write(file_path, content)

    files = await async_sandbox.files.list(test_dir, depth=1)
    assert len(files) == 1

    file_entry = files[0]
    assert file_entry.name == "test.txt"
    assert file_entry.path == f"/home/user/{file_path}"
    assert file_entry.type == FileType.FILE
    assert file_entry.mode == 0o644
    assert file_entry.permissions == "-rw-r--r--"
    assert file_entry.owner == "user"
    assert file_entry.group == "user"
    assert file_entry.size == len(content)
    assert file_entry.modified_time is not None
    assert file_entry.symlink_target is None

    await async_sandbox.files.remove(test_dir)


async def test_directory_entry_details(async_sandbox: AsyncSandbox):
    test_dir = "test-entry-info"
    sub_dir = f"{test_dir}/subdir"

    await async_sandbox.files.make_dir(test_dir)
    await async_sandbox.files.make_dir(sub_dir)

    files = await async_sandbox.files.list(test_dir, depth=1)
    assert len(files) == 1

    dir_entry = files[0]
    assert dir_entry.name == "subdir"
    assert dir_entry.path == f"/home/user/{sub_dir}"
    assert dir_entry.type == FileType.DIR
    assert dir_entry.mode == 0o755
    assert dir_entry.permissions == "drwxr-xr-x"
    assert dir_entry.owner == "user"
    assert dir_entry.group == "user"
    assert dir_entry.modified_time is not None
    assert dir_entry.symlink_target is None

    await async_sandbox.files.remove(test_dir)


async def test_mixed_entries(async_sandbox: AsyncSandbox):
    test_dir = "test-mixed-entries"
    sub_dir = f"{test_dir}/subdir"
    file_path = f"{test_dir}/test.txt"
    content = "Hello, World!"

    await async_sandbox.files.make_dir(test_dir)
    await async_sandbox.files.make_dir(sub_dir)
    await async_sandbox.files.write(file_path, content)

    files = await async_sandbox.files.list(test_dir, depth=1)
    assert len(files) == 2

    # Create a dictionary of entries by name for easier verification
    entries = {entry.name: entry for entry in files}

    # Verify directory entry
    dir_entry = entries.get("subdir")
    assert dir_entry is not None
    assert dir_entry.path == f"/home/user/{sub_dir}"
    assert dir_entry.type == FileType.DIR
    assert dir_entry.mode == 0o755
    assert dir_entry.permissions == "drwxr-xr-x"
    assert dir_entry.owner == "user"
    assert dir_entry.group == "user"
    assert dir_entry.modified_time is not None

    # Verify file entry
    file_entry = entries.get("test.txt")
    assert file_entry is not None
    assert file_entry.path == f"/home/user/{file_path}"
    assert file_entry.type == FileType.FILE
    assert file_entry.mode == 0o644
    assert file_entry.permissions == "-rw-r--r--"
    assert file_entry.owner == "user"
    assert file_entry.group == "user"
    assert file_entry.size == len(content)
    assert file_entry.modified_time is not None

    await async_sandbox.files.remove(test_dir)
