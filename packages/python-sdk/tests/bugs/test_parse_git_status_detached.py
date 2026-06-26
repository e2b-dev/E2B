from e2b.sandbox._git.parse import parse_git_status


def test_upstream_with_detached_in_name_is_not_detached_head():
    # Branch 'main' tracking 'origin/detached-work': NOT a detached HEAD.
    # Previously "detached" in raw_branch caused a false positive.
    output = "## main...origin/detached-work\n"
    status = parse_git_status(output)
    assert not status.detached
    assert status.current_branch == "main"
    assert status.upstream == "origin/detached-work"
