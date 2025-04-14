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
            "name": "explicit depth 0 (should default to 1)",
            "depth": 0,
            "expected_len": 2,
            "expected_files": ["subdir1", "subdir2"],
        },
        {
            "name": "default depth (1)",
            "depth": None,
            "expected_len": 2,
            "expected_files": ["subdir1", "subdir2"],
        },
        {
            "name": "explicit depth 1",
            "depth": 1,
            "expected_len": 2,
            "expected_files": ["subdir1", "subdir2"],
        },
        {
            "name": "explicit depth 2",
            "depth": 2,
            "expected_len": 6,
            "expected_files": [
                "subdir1",
                "subdir1_1",
                "subdir1_2",
                "subdir2",
                "subdir2_1",
                "subdir2_2",
            ],
        },
        {
            "name": "explicit depth 3 (should be the same as depth 2)",
            "depth": 3,
            "expected_len": 6,
            "expected_files": [
                "subdir1",
                "subdir1_1",
                "subdir1_2",
                "subdir2",
                "subdir2_1",
                "subdir2_2",
            ],
        },
        {
            "name": "negative depth should error",
            "depth": -1,
            "expected_len": 0,
            "expected_files": [],
            "expect_error": "Value out of range",
        },
    ]

    for test_case in test_cases:
        if "expect_error" in test_case:
            try:
                await async_sandbox.files.list(
                    parent_dir_name,
                    depth=(
                        test_case["depth"] if test_case["depth"] is not None else None
                    ),
                )
                assert False, "Expected error but none was thrown"
            except Exception as err:
                assert test_case["expect_error"] in str(
                    err
                ), f'expected error message to include "{test_case["expect_error"]}"'
                continue
        else:
            # Get files list with specified depth (or default if None)
            files = await async_sandbox.files.list(
                parent_dir_name,
                depth=test_case["depth"] if test_case["depth"] is not None else None,
            )

            # Verify number of files
            assert len(files) == test_case["expected_len"]

            # Verify file names match expected order
            for i, expected_name in enumerate(test_case["expected_files"]):
                assert files[i].name == expected_name

    # Cleanup
    await async_sandbox.files.remove(parent_dir_name)
