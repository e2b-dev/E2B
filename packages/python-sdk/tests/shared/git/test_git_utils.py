from e2b.sandbox.git_utils import parse_git_branches, parse_git_status


def test_parse_git_status():
    output = (
        "## main...origin/main [ahead 2, behind 1]\n"
        " M README.md\n"
        "A  new.txt\n"
        "R  old.txt -> renamed.txt\n"
        "?? untracked.txt\n"
    )

    status = parse_git_status(output)

    assert status.current_branch == "main"
    assert status.ahead == 2
    assert status.behind == 1
    assert [entry.name for entry in status.file_status] == [
        "README.md",
        "new.txt",
        "renamed.txt",
        "untracked.txt",
    ]
    assert status.file_status[2].renamed_from == "old.txt"


def test_parse_git_status_preserves_leading_spaces():
    output = "## main\n M README.md\n"
    status = parse_git_status(output)

    assert status.file_status[0].index_status == " "
    assert status.file_status[0].working_tree_status == "M"
    assert status.file_status[0].staged is False


def test_parse_git_branches():
    output = "main\t*\nfeature\t\n"
    branches = parse_git_branches(output)

    assert branches.branches == ["main", "feature"]
    assert branches.current_branch == "main"


def test_parse_git_status_detects_detached_head():
    output = "## HEAD (detached at abc123)\n"
    status = parse_git_status(output)

    assert status.detached is True
    assert status.current_branch is None
