import pytest

from e2b_dockerfile_utils import PatternMatcher


def test_matches_like_dockerignore():
    matcher = PatternMatcher(
        [
            "# comment",
            "",
            "node_modules",
            "/dist/",
            "*.log",
            "**/*.tmp",
            "docs/**",
            "!docs/README.md",
            "src/[a-c]?.py",
        ]
    )

    assert matcher.matches("node_modules")
    assert matcher.matches("node_modules/pkg/index.js")
    assert not matcher.matches("src/node_modules")
    assert matcher.matches("dist")
    assert matcher.matches("dist/index.js")
    assert matcher.matches("app.log")
    assert not matcher.matches("logs/app.log")
    assert matcher.matches("a/b/c.tmp")
    assert matcher.matches("docs/guide/intro.md")
    assert not matcher.matches("docs/README.md")
    assert not matcher.matches("docs")
    assert matcher.matches("src/a1.py")
    assert not matcher.matches("src/d1.py")
    assert not matcher.matches("src/index.py")


def test_parent_match_excludes_everything_under_it():
    matcher = PatternMatcher(["build", "!build/keep"])
    assert matcher.matches("build/out.js")
    assert not matcher.matches("build/keep")
    assert not matcher.matches("build/keep/file")


def test_may_match_under():
    matcher = PatternMatcher(["*", "!src/lib/**", "!a/b/c"])
    assert matcher.may_match_under("src")
    assert matcher.may_match_under("src/lib")
    assert matcher.may_match_under("a/b")
    assert not matcher.may_match_under("a/b/c")
    assert not matcher.may_match_under("other")


def test_cleans_patterns():
    matcher = PatternMatcher(["./a//b/", "c/./d/../e", "/f/", "../g", "/../h"])
    assert matcher.matches("a/b")
    assert matcher.matches("c/e")
    assert matcher.matches("f/x")
    assert matcher.matches("../g")
    assert matcher.matches("h")


def test_backslash_handling():
    assert PatternMatcher(["a\\*b"]).matches("a*b")
    assert not PatternMatcher(["a\\*b"]).matches("a/b")
    windows = PatternMatcher(["a\\*b", "c\\d"], backslash_is_separator=True)
    assert windows.matches("a/xb")
    assert windows.matches("c/d/e")


def test_rejects_invalid_patterns_with_value_error():
    with pytest.raises(ValueError, match=r"Invalid ignore pattern '\[abc'"):
        PatternMatcher(["[abc"])
    with pytest.raises(ValueError, match=r"Invalid ignore pattern '\[\\q\]'"):
        PatternMatcher(["[\\q]"])
