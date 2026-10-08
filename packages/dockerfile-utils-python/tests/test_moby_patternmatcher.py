import pytest

from e2b_dockerfile_utils import PatternMatcher

# Port of moby/patternmatcher v0.6.1 `patternmatcher_test.go` and
# `ignorefile/ignorefile_test.go`. `Matches`, `MatchesOrParentMatches`,
# `MatchesUsingParentResult(s)` all map to `PatternMatcher.matches`.


def matches(text: str, patterns: list[str]) -> bool:
    return PatternMatcher(patterns).matches(text)


# (pattern, text, pass)
MATCHES_TESTS = [
    ("**", "file", True),
    ("**", "file/", True),
    ("**/", "file", True),  # weird one
    ("**/", "file/", True),
    ("**", "/", True),
    ("**/", "/", True),
    ("**", "dir/file", True),
    ("**/", "dir/file", True),
    ("**", "dir/file/", True),
    ("**/", "dir/file/", True),
    ("**/**", "dir/file", True),
    ("**/**", "dir/file/", True),
    ("dir/**", "dir/file", True),
    ("dir/**", "dir/file/", True),
    ("dir/**", "dir/dir2/file", True),
    ("dir/**", "dir/dir2/file/", True),
    ("**/dir", "dir", True),
    ("**/dir", "dir/file", True),
    ("**/dir2/*", "dir/dir2/file", True),
    ("**/dir2/*", "dir/dir2/file/", True),
    ("**/dir2/**", "dir/dir2/dir3/file", True),
    ("**/dir2/**", "dir/dir2/dir3/file/", True),
    ("**file", "file", True),
    ("**file", "dir/file", True),
    ("**/file", "dir/file", True),
    ("**file", "dir/dir/file", True),
    ("**/file", "dir/dir/file", True),
    ("**/file*", "dir/dir/file", True),
    ("**/file*", "dir/dir/file.txt", True),
    ("**/file*txt", "dir/dir/file.txt", True),
    ("**/file*.txt", "dir/dir/file.txt", True),
    ("**/file*.txt*", "dir/dir/file.txt", True),
    ("**/**/*.txt", "dir/dir/file.txt", True),
    ("**/**/*.txt2", "dir/dir/file.txt", False),
    ("**/*.txt", "file.txt", True),
    ("**/**/*.txt", "file.txt", True),
    ("a**/*.txt", "a/file.txt", True),
    ("a**/*.txt", "a/dir/file.txt", True),
    ("a**/*.txt", "a/dir/dir/file.txt", True),
    ("a/*.txt", "a/dir/file.txt", False),
    ("a/*.txt", "a/file.txt", True),
    ("a/*.txt**", "a/file.txt", True),
    ("a[b-d]e", "ae", False),
    ("a[b-d]e", "ace", True),
    ("a[b-d]e", "aae", False),
    ("a[^b-d]e", "aze", True),
    (".*", ".foo", True),
    (".*", "foo", False),
    ("abc.def", "abcdef", False),
    ("abc.def", "abc.def", True),
    ("abc.def", "abcZdef", False),
    ("abc?def", "abcZdef", True),
    ("abc?def", "abcdef", False),
    ("a\\\\", "a\\", True),
    ("**/foo/bar", "foo/bar", True),
    ("**/foo/bar", "dir/foo/bar", True),
    ("**/foo/bar", "dir/dir2/foo/bar", True),
    ("abc/**", "abc", False),
    ("abc/**", "abc/def", True),
    ("abc/**", "abc/def/ghi", True),
    ("**/.foo", ".foo", True),
    ("**/.foo", "bar.foo", False),
    ("a(b)c/def", "a(b)c/def", True),
    ("a(b)c/def", "a(b)c/xyz", False),
    ("a.|)$(}+{bc", "a.|)$(}+{bc", True),
    (
        "dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl",
        "dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl",
        True,
    ),
    ("dist/*.whl", "dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl", True),
    # non-windows only upstream
    ("a\\*b", "a*b", True),
]

# (patterns, text, pass)
MULTI_PATTERN_TESTS = [
    (["**", "!util/docker/web"], "util/docker/web/foo", False),
    (["**", "!util/docker/web", "util/docker/web/foo"], "util/docker/web/foo", True),
    (
        ["**", "!dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl"],
        "dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl",
        False,
    ),
    (
        ["**", "!dist/*.whl"],
        "dist/proxy.py-2.4.0rc3.dev36+g08acad9-py3-none-any.whl",
        False,
    ),
]

# (pattern, s, match, bad pattern)
MATCH_TESTS = [
    ("abc", "abc", True, False),
    ("*", "abc", True, False),
    ("*c", "abc", True, False),
    ("a*", "a", True, False),
    ("a*", "abc", True, False),
    ("a*", "ab/c", True, False),
    ("a*/b", "abc/b", True, False),
    ("a*/b", "a/c/b", False, False),
    ("a*b*c*d*e*/f", "axbxcxdxe/f", True, False),
    ("a*b*c*d*e*/f", "axbxcxdxexxx/f", True, False),
    ("a*b*c*d*e*/f", "axbxcxdxe/xxx/f", False, False),
    ("a*b*c*d*e*/f", "axbxcxdxexxx/fff", False, False),
    ("a*b?c*x", "abxbbxdbxebxczzx", True, False),
    ("a*b?c*x", "abxbbxdbxebxczzy", False, False),
    ("ab[c]", "abc", True, False),
    ("ab[b-d]", "abc", True, False),
    ("ab[e-g]", "abc", False, False),
    ("ab[^c]", "abc", False, False),
    ("ab[^b-d]", "abc", False, False),
    ("ab[^e-g]", "abc", True, False),
    ("a\\*b", "a*b", True, False),
    ("a\\*b", "ab", False, False),
    ("a?b", "a☺b", True, False),
    ("a[^a]b", "a☺b", True, False),
    ("a???b", "a☺b", False, False),
    ("a[^a][^a][^a]b", "a☺b", False, False),
    ("[a-ζ]*", "α", True, False),
    ("*[a-ζ]", "A", False, False),
    ("a?b", "a/b", False, False),
    ("a*b", "a/b", False, False),
    ("[\\]a]", "]", True, False),
    ("[\\-]", "-", True, False),
    ("[x\\-]", "x", True, False),
    ("[x\\-]", "-", True, False),
    ("[x\\-]", "z", False, False),
    ("[\\-x]", "x", True, False),
    ("[\\-x]", "-", True, False),
    ("[\\-x]", "a", False, False),
    ("[]a]", "]", False, True),
    ("[-]", "-", False, True),
    ("[x-]", "x", False, True),
    ("[x-]", "-", False, True),
    ("[x-]", "z", False, True),
    ("[-x]", "x", False, True),
    ("[-x]", "-", False, True),
    ("[-x]", "a", False, True),
    ("\\", "a", False, True),
    ("[a-b-c]", "a", False, True),
    ("[", "a", False, True),
    ("[^", "a", False, True),
    ("[^bc", "a", False, True),
    ("a[", "a", False, True),
    ("a[", "ab", False, True),
    ("*x", "xxx", True, False),
]


def test_wildcard_matches():
    assert matches("fileutils.go", ["*"])


def test_pattern_matches():
    assert matches("fileutils.go", ["*.go"])


def test_exclusion_pattern_matches_pattern_before():
    assert matches("fileutils.go", ["!fileutils.go", "*.go"])


def test_pattern_matches_folder_exclusions():
    assert not matches("docs/README.md", ["docs", "!docs/README.md"])


def test_pattern_matches_folder_with_slash_exclusions():
    assert not matches("docs/README.md", ["docs/", "!docs/README.md"])


def test_pattern_matches_folder_wildcard_exclusions():
    assert not matches("docs/README.md", ["docs/*", "!docs/README.md"])


def test_exclusion_pattern_matches_pattern_after():
    assert not matches("fileutils.go", ["*.go", "!fileutils.go"])


def test_exclusion_pattern_matches_whole_directory():
    assert not matches(".", ["*.go"])


def test_single_exclamation_error():
    with pytest.raises(ValueError, match="illegal exclusion"):
        matches("fileutils.go", ["!"])


def test_matches_with_no_patterns():
    assert not matches("/any/path/there", [])


def test_matches_with_malformed_patterns():
    with pytest.raises(ValueError):
        matches("/any/path/there", ["["])


@pytest.mark.parametrize(("pattern", "text", "expected"), MATCHES_TESTS)
def test_matches(pattern: str, text: str, expected: bool):
    assert matches(text, [pattern]) is expected


@pytest.mark.parametrize(("patterns", "text", "expected"), MULTI_PATTERN_TESTS)
def test_matches_multi_pattern(patterns: list[str], text: str, expected: bool):
    assert matches(text, patterns) is expected


# Upstream runs the same table on Windows, where `filepath.Clean` turns the
# slashes into backslashes
@pytest.mark.parametrize(
    ("pattern", "text", "expected"),
    [case for case in MATCHES_TESTS if "\\" not in case[0]],
)
def test_matches_windows(pattern: str, text: str, expected: bool):
    matcher = PatternMatcher([pattern.replace("/", "\\")], backslash_is_separator=True)
    assert matcher.matches(text.replace("/", "\\")) is expected


def test_clean_patterns():
    assert len(PatternMatcher(["docs", "config"]).patterns) == 2


def test_clean_patterns_strip_empty_patterns():
    assert len(PatternMatcher(["docs", "config", ""]).patterns) == 2


def test_clean_patterns_exception_flag():
    matcher = PatternMatcher(["docs", "!docs/README.md"])
    assert matcher.patterns == ["docs", "!docs/README.md"]


def test_clean_patterns_leading_space_trimmed():
    matcher = PatternMatcher(["docs", "  !docs/README.md"])
    assert matcher.patterns == ["docs", "!docs/README.md"]


def test_clean_patterns_trailing_space_trimmed():
    matcher = PatternMatcher(["docs", "!docs/README.md  "])
    assert matcher.patterns == ["docs", "!docs/README.md"]


def test_clean_patterns_error_single_exception():
    with pytest.raises(ValueError, match="illegal exclusion"):
        PatternMatcher(["!"])


@pytest.mark.parametrize(("pattern", "s", "expected", "bad"), MATCH_TESTS)
def test_match(pattern: str, s: str, expected: bool, bad: bool):
    if bad:
        with pytest.raises(ValueError, match="syntax error"):
            PatternMatcher([pattern])
        return
    assert matches(s, [pattern]) is expected


# On Windows upstream skips the patterns containing backslashes
@pytest.mark.parametrize(
    ("pattern", "s", "expected", "bad"),
    [case for case in MATCH_TESTS if "\\" not in case[0]],
)
def test_match_windows(pattern: str, s: str, expected: bool, bad: bool):
    def create() -> PatternMatcher:
        return PatternMatcher([pattern.replace("/", "\\")], backslash_is_separator=True)

    if bad:
        with pytest.raises(ValueError, match="syntax error"):
            create()
        return
    assert create().matches(s.replace("/", "\\")) is expected


def test_matches_or_parent_matches_malformed_pattern_does_not_panic_on_repeated_call():
    # Upstream only fails when matching; the patterns are compiled upfront
    # here so the bad range is reported when the matcher is created
    with pytest.raises(ValueError):
        PatternMatcher(["[Local-Only]/"])
    with pytest.raises(ValueError):
        PatternMatcher(["[Local-Only]/"])


def test_ignorefile_read_all():
    content = [
        "test1",
        "/test2",
        "/a/file/here",
        "",
        "lastfile",
        "# this is a comment",
        " # not a comment",
        "! /inverted/abs/path",
    ]
    assert PatternMatcher(content).patterns == [
        "test1",
        "test2",
        "a/file/here",
        "lastfile",
        "# not a comment",
        "!inverted/abs/path",
    ]
    # Upstream `ReadAll` keeps `!` and `! ` as `!`, which `New` then rejects
    with pytest.raises(ValueError):
        PatternMatcher([*content, "!"])
    with pytest.raises(ValueError):
        PatternMatcher([*content, "! "])
