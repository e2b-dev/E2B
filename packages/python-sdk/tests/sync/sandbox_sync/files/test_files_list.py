import uuid

from e2b import Sandbox, FileType


def test_list_directory(sandbox: Sandbox):
    home_dir_name = "/home/user"
    parent_dir_name = f"test_directory_{uuid.uuid4()}"

    sandbox.files.make_dir(parent_dir_name)
    sandbox.files.make_dir(f"{parent_dir_name}/subdir1")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir2")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir1/subdir1_1")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir1/subdir1_2")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir2/subdir2_1")
    sandbox.files.make_dir(f"{parent_dir_name}/subdir2/subdir2_2")
    sandbox.files.write(f"{parent_dir_name}/file1.txt", "Hello, world!")

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
        files = sandbox.files.list(
            parent_dir_name,
            depth=test_case["depth"] if test_case["depth"] is not None else None,
        )

        assert len(files) == test_case["expected_len"]

        for i in range(len(test_case["expected_file_names"])):
            assert files[i].name == test_case["expected_file_names"][i]
            assert files[i].path == test_case["expected_file_paths"][i]
            assert files[i].type == test_case["expected_file_types"][i]

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
