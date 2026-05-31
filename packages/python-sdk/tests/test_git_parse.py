from e2b.sandbox._git.parse import parse_git_status


def test_parse_git_status_branch_name_with_ellipsis():
    # Branch named "feat...v2" tracking "origin/feat...v2" — split("...") without maxsplit
    # used to crash with ValueError: too many values to unpack (expected 2).
    output = "## feat...v2...origin/feat...v2\n"
    result = parse_git_status(output)
    assert result.current_branch == "feat"
    assert result.upstream == "v2...origin/feat...v2"
    assert not result.detached
