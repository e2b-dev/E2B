from e2b.sandbox._git import parse_git_status


def test_status_upstream_branch_containing_word_detached_is_not_detached():
    # Regression test for #1373: a repository tracking an upstream branch
    # whose name merely contains the substring "detached" (e.g.
    # origin/detached-work) must not be reported as being in detached HEAD
    # state.
    status = parse_git_status("## main...origin/detached-work\n")

    assert status.detached is False
    assert status.current_branch == "main"
    assert status.upstream == "origin/detached-work"


def test_status_real_detached_head_is_still_detected():
    status = parse_git_status("## HEAD (detached at abc1234)\n")

    assert status.detached is True
    assert status.current_branch is None
    assert status.upstream is None


def test_status_head_no_branch_is_still_detected():
    status = parse_git_status("## HEAD (no branch)\n")

    assert status.detached is True


def test_status_branch_containing_extra_ellipsis_does_not_raise():
    # Regression test for #1371: a normalized branch header containing more
    # than one "..." separator must not crash the two-value unpack. Only the
    # first "..." separates branch from upstream; anything after it is part
    # of the upstream name.
    status = parse_git_status("## feat...v2...origin/feat...v2\n")

    assert status.current_branch == "feat"
    assert status.upstream == "v2...origin/feat...v2"


def test_status_ahead_behind_still_parsed():
    status = parse_git_status("## main...origin/main [ahead 2, behind 1]\n")

    assert status.current_branch == "main"
    assert status.upstream == "origin/main"
    assert status.ahead == 2
    assert status.behind == 1
    assert status.detached is False
