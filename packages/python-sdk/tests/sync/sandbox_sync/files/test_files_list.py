import uuid

from e2b import Sandbox


def test_list_directory(sandbox: Sandbox):
    parent_dir_name = f"test_directory_{uuid.uuid4()}"

    sandbox.files.make_dir(parent_dir_name)
    sandbox.files.make_dir(f"{parent_dir_name}/subdir1")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir2")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir1/subdir1_1")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir1/subdir1_2")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir2/subdir2_1")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir2/subdir2_2")

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
        files = sandbox.files.list(
            parent_dir_name,
            depth=test_case["depth"] if test_case["depth"] is not None else None,
        )

        assert len(files) == test_case["expected_len"]

        for i, expected_name in enumerate(test_case["expected_files"]):
            assert files[i].name == expected_name

    sandbox.files.remove(parent_dir_name)


def test_list_directory_error_cases(sandbox: Sandbox):
    parent_dir_name = f"test_directory_{uuid.uuid4()}"
    sandbox.files.make_dir(parent_dir_name)

    expected_error_message = "depth should be at least 1"
    try:
        sandbox.files.list(parent_dir_name, depth=-1)
        assert False, "Expected error but none was thrown"
    except Exception as err:
        assert expected_error_message in str(
            err
        ), f'expected error message to include "{expected_error_message}"'

    sandbox.files.remove(parent_dir_name)
