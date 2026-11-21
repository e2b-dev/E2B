import pytest

from e2b.sandbox._git.parse import parse_git_status

# Every pair git-status(1) lists for an unmerged path. Only the pairs that
# contain a `U` used to be reported as conflicts, so an add/add (`AA`) or a
# both-deleted (`DD`) merge conflict came back as `added`/`deleted`.
UNMERGED_PAIRS = ["DD", "AU", "UD", "UA", "DU", "AA", "UU"]


@pytest.mark.parametrize("pair", UNMERGED_PAIRS)
def test_unmerged_entry_is_reported_as_a_conflict(pair):
    # AA is the porcelain output for "CONFLICT (add/add): Merge conflict in file".
    status = parse_git_status(f"## main\n{pair} file.txt\n")

    assert len(status.file_status) == 1
    assert status.file_status[0].status == "conflict"
    assert status.has_conflicts is True
    assert status.conflict_count == 1


def test_add_add_conflict_of_a_whole_merge_is_counted():
    status = parse_git_status("## main\nAA added-by-both.txt\nUU modified-by-both.txt\n")

    assert [entry.status for entry in status.file_status] == ["conflict", "conflict"]
    assert status.conflict_count == 2
    assert status.total_count == 2


@pytest.mark.parametrize(
    ("pair", "expected"),
    [
        ("A ", "added"),
        (" D", "deleted"),
        ("M ", "modified"),
        (" M", "modified"),
        ("R ", "renamed"),
        ("C ", "copied"),
        ("T ", "typechange"),
        ("aa", "unknown"),
    ],
)
def test_pairs_that_are_not_conflicts_keep_their_label(pair, expected):
    status = parse_git_status(f"## main\n{pair}file.txt\n")

    assert status.file_status[0].status == expected
    assert status.conflict_count == 0
