from e2b.sandbox._git.parse import parse_git_status


def test_split_does_not_crash_with_extra_dots():
    """Malformed branch lines with multiple '...' should not crash (issue #1371)."""
    output = "## feat...v2...origin/feat...v2\n"
    # Should not raise ValueError; exact parsing is best-effort
    status = parse_git_status(output)
    assert status.current_branch is not None
    assert status.detached is False


def test_upstream_branch_containing_detached():
    """Branches tracking an upstream with 'detached' in the name should not
    be misidentified as detached HEAD (issue #1373)."""
    output = "## my-branch...origin/detached-work\n"
    status = parse_git_status(output)
    assert status.current_branch == "my-branch"
    assert status.upstream == "origin/detached-work"
    assert status.detached is False


def test_branch_named_detached():
    """A branch literally named 'detached' should not be treated as
    detached HEAD."""
    output = "## detached\n"
    status = parse_git_status(output)
    assert status.current_branch == "detached"
    assert status.detached is False


def test_actual_detached_head():
    """Real detached HEAD should still be detected."""
    output = "## HEAD (detached at abc1234)\n"
    status = parse_git_status(output)
    assert status.detached is True


def test_branch_name_containing_detached_substring():
    """Branch names like 'fix-detached-bug' should not be treated as detached."""
    output = "## fix-detached-bug...origin/fix-detached-bug\n"
    status = parse_git_status(output)
    assert status.current_branch == "fix-detached-bug"
    assert status.upstream == "origin/fix-detached-bug"
    assert status.detached is False


def test_no_commits_yet():
    """'No commits yet on main' should parse as branch 'main', not detached."""
    output = "## No commits yet on main\n"
    status = parse_git_status(output)
    assert status.current_branch == "main"
    assert status.detached is False


def test_head_no_branch():
    """'HEAD (no branch)' should be treated as detached."""
    output = "## HEAD (no branch)\n"
    status = parse_git_status(output)
    assert status.detached is True


def test_simple_branch_no_upstream():
    """A branch with no upstream tracking should parse correctly."""
    output = "## feature-branch\n"
    status = parse_git_status(output)
    assert status.current_branch == "feature-branch"
    assert status.upstream is None
    assert status.detached is False


def test_empty_output():
    """Empty output should return a clean status."""
    status = parse_git_status("")
    assert status.current_branch is None
    assert status.detached is False
    assert status.file_status == []


def test_normal_branch_with_upstream():
    """Normal branch tracking upstream should parse correctly."""
    output = "## main...origin/main [ahead 1, behind 2]\n"
    status = parse_git_status(output)
    assert status.current_branch == "main"
    assert status.upstream == "origin/main"
    assert status.ahead == 1
    assert status.behind == 2
    assert status.detached is False
