"""String-level unit tests for the .dockerignore ``PatternMatcher``.

These cover the pattern semantics directly, without walking a filesystem, so
they run the same on every platform.
"""

import pytest

from e2b.template.dockerignore import PatternMatcher


class TestLeadingGlobstarLiteralSuffix:
    """A leading ``**`` followed only by literals is a suffix match."""

    @pytest.mark.parametrize(
        "path",
        [
            "a.txt",
            "keep1.txt",
            "src/nested.txt",
            "src/generated/deep.txt",
            "weird\nname\nx.txt",
        ],
    )
    def test_matches_a_path_ending_in_the_suffix(self, path: str) -> None:
        assert PatternMatcher(["**.txt"]).matches(path)

    @pytest.mark.parametrize(
        "path",
        [
            "keep.txt.bak",
            "keep1.txtx",
            "a.txt\n",
            "notes.md",
        ],
    )
    def test_does_not_match_without_the_suffix(self, path: str) -> None:
        assert not PatternMatcher(["**.txt"]).matches(path)

    def test_regex_characters_in_the_suffix_stay_literal(self) -> None:
        matcher = PatternMatcher(["**(1).txt"])
        assert matcher.matches("root(1).txt")
        assert not matcher.matches("root1.txt")

    def test_a_newline_inside_the_name_does_not_hide_the_suffix(self) -> None:
        """Filenames may contain newlines; the match must remain a literal
        suffix match in both directions."""
        matcher = PatternMatcher(["**.txt"])
        assert matcher.matches("a\n.txt")
        assert not matcher.matches("a.txt\n")
