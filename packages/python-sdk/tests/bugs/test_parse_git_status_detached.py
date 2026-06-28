from e2b.sandbox._git.parse import parse_git_status


def test_upstream_with_detached_in_name_is_not_detached_head():
    status = parse_git_status("## main...origin/detached-work\n")

    assert not status.detached
    assert status.current_branch == "main"
    assert status.upstream == "origin/detached-work"


def test_branch_with_detached_in_name_is_not_detached_head():
    status = parse_git_status("## feature/detached-session-fix\n")

    assert not status.detached
    assert status.current_branch == "feature/detached-session-fix"


def test_head_with_no_branch_is_detached():
    status = parse_git_status("## HEAD (no branch)\n")

    assert status.detached


def test_head_detached_at_commit_is_detached():
    status = parse_git_status("## HEAD (detached at 1a2b3c4)\n")

    assert status.detached
