import uuid

from e2b import AsyncSandbox, FileType


async def test_list_directory(async_sandbox: AsyncSandbox):
    parent_dir_name = f"test_directory_{uuid.uuid4()}"

    await async_sandbox.files.make_dir(parent_dir_name)
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir1")
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir2")
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir1/subdir1_1")
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir1/subdir1_2")
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir2/subdir2_1")
    await async_sandbox.files.make_dir(f"{parent_dir_name}/subdir2/subdir2_2")

    test_cases = [
        {
            "name": "default depth (1)",
            "depth": None,
            "expected_len": 2,
            "expected_files": [
                f"{parent_dir_name}/subdir1",
                f"{parent_dir_name}/subdir2",
            ],
        },
        {
            "name": "explicit depth 1",
            "depth": 1,
            "expected_len": 2,
            "expected_files": [
                f"{parent_dir_name}/subdir1",
                f"{parent_dir_name}/subdir2",
            ],
        },
        {
            "name": "explicit depth 2",
            "depth": 2,
            "expected_len": 6,
            "expected_files": [
                f"{parent_dir_name}/subdir1",
                f"{parent_dir_name}/subdir1/subdir1_1",
                f"{parent_dir_name}/subdir1/subdir1_2",
                f"{parent_dir_name}/subdir2",
                f"{parent_dir_name}/subdir2/subdir2_1",
                f"{parent_dir_name}/subdir2/subdir2_2",
            ],
        },
        {
            "name": "explicit depth 3 (should be the same as depth 2)",
            "depth": 3,
            "expected_len": 6,
            "expected_files": [
                f"{parent_dir_name}/subdir1",
                f"{parent_dir_name}/subdir1/subdir1_1",
                f"{parent_dir_name}/subdir1/subdir1_2",
                f"{parent_dir_name}/subdir2",
                f"{parent_dir_name}/subdir2/subdir2_1",
                f"{parent_dir_name}/subdir2/subdir2_2",
            ],
        },
    ]

    for test_case in test_cases:
        files = await async_sandbox.files.list(
            parent_dir_name,
            depth=test_case["depth"] if test_case["depth"] is not None else None,
        )

        assert len(files) == test_case["expected_len"]

        for i, expected_name in enumerate(test_case["expected_files"]):
            assert files[i].name == expected_name

    await async_sandbox.files.remove(parent_dir_name)


async def test_list_directory_error_cases(async_sandbox: AsyncSandbox):
    parent_dir_name = f"test_directory_{uuid.uuid4()}"
    await async_sandbox.files.make_dir(parent_dir_name)

    expected_error_message = "depth should be at least one"
    try:
        await async_sandbox.files.list(parent_dir_name, depth=-1)
        assert False, "Expected error but none was thrown"
    except Exception as err:
        assert expected_error_message in str(
            err
        ), f'expected error message to include "{expected_error_message}"'

    await async_sandbox.files.remove(parent_dir_name)
