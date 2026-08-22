from e2b.sandbox._git.parse import parse_git_status


def test_status_does_not_treat_detached_in_upstream_name_as_detached():
    status = parse_git_status("## main...origin/detached-work\n")

    assert status.current_branch == "main"
    assert status.upstream == "origin/detached-work"
    assert status.detached is False


def test_status_does_not_treat_head_prefix_in_branch_name_as_detached():
    status = parse_git_status("## HEADless-refactor...origin/HEADless-refactor\n")

    assert status.current_branch == "HEADless-refactor"
    assert status.upstream == "origin/HEADless-refactor"
    assert status.detached is False


def test_status_still_detects_detached_head():
    status = parse_git_status("## HEAD (detached at abc123)\n")

    assert status.detached is True


def test_status_detects_detached_head_with_no_branch():
    status = parse_git_status("## HEAD (no branch)\n")

    assert status.detached is True
