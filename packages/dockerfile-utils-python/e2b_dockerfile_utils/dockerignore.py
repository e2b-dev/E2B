"""
Matching of `.dockerignore` patterns, following the semantics Docker uses to
filter the build context.

Port of the pattern matcher from moby/patternmatcher (Apache-2.0):
https://github.com/moby/patternmatcher
"""

import posixpath
import re
from enum import Enum
from typing import Callable, List

# Characters that have a meaning in a regex but not in a Docker pattern
_LITERAL_REGEX_CHARS = set(".+()|{}$^")
_WILDCARD_CHARS = re.compile(r"[*?\[\\]")


class _MatchType(Enum):
    EXACT = "exact"
    PREFIX = "prefix"
    SUFFIX = "suffix"
    REGEX = "regex"


def _clean(pattern: str) -> str:
    # Equivalent of Go's filepath.Clean on a slash-separated path
    return posixpath.normpath(re.sub("/+", "/", pattern))


_BAD_PATTERN = "syntax error in pattern"


def _class_char(pattern: str, i: int, backslash_is_escape: bool) -> int:
    # Advances over one (possibly escaped) character of a bracket expression
    n = len(pattern)
    if i >= n or pattern[i] in "-]":
        raise ValueError(_BAD_PATTERN)
    if pattern[i] == "\\" and backslash_is_escape:
        i += 1
        if i >= n:
            raise ValueError(_BAD_PATTERN)
    i += 1
    if i >= n:
        raise ValueError(_BAD_PATTERN)
    return i


def _validate_pattern(pattern: str, backslash_is_escape: bool) -> None:
    # Rejects what Go's filepath.Match rejects (Docker validates patterns with
    # it), as regex engines are more lenient about bracket expressions
    n = len(pattern)
    i = 0
    while i < n:
        ch = pattern[i]
        i += 1
        if ch == "\\" and backslash_is_escape:
            if i >= n:
                raise ValueError(_BAD_PATTERN)
            i += 1
        elif ch == "[":
            if i < n and pattern[i] == "^":
                i += 1
            ranges = 0
            while not (ranges > 0 and i < n and pattern[i] == "]"):
                i = _class_char(pattern, i, backslash_is_escape)
                if pattern[i] == "-":
                    i = _class_char(pattern, i + 1, backslash_is_escape)
                ranges += 1
            i += 1


def _compile(pattern: str, backslash_is_escape: bool) -> Callable[[str], bool]:
    _validate_pattern(pattern, backslash_is_escape)
    # Like moby, use plain string checks for patterns without wildcards and
    # only fall back to a regex otherwise
    regex = "^"
    match_type = _MatchType.EXACT
    i, n = 0, len(pattern)
    while i < n:
        first = i == 0
        ch = pattern[i]
        i += 1
        if ch == "*":
            if i < n and pattern[i] == "*":
                i += 1
                # Treat "**/" as "**"
                if i < n and pattern[i] == "/":
                    i += 1
                if i >= n:
                    regex += ".*"
                    match_type = (
                        _MatchType.PREFIX
                        if match_type is _MatchType.EXACT
                        else _MatchType.REGEX
                    )
                else:
                    regex += "(.*/)?"
                    match_type = _MatchType.REGEX
                if first:
                    match_type = _MatchType.SUFFIX
            else:
                regex += "[^/]*"
                match_type = _MatchType.REGEX
        elif ch == "?":
            regex += "[^/]"
            match_type = _MatchType.REGEX
        elif ch == "[":
            # Copy a bracket expression as is, a leading "^" negates it
            j = i
            if j < n and pattern[j] == "^":
                j += 1
            while j < n and pattern[j] != "]":
                if pattern[j] == "\\" and backslash_is_escape:
                    j += 1
                j += 1
            regex += pattern[i - 1 : j + 1]
            i = j + 1
            match_type = _MatchType.REGEX
        elif ch == "]":
            regex += ch
            match_type = _MatchType.REGEX
        elif ch in _LITERAL_REGEX_CHARS:
            regex += "\\" + ch
        elif ch == "\\" and backslash_is_escape:
            # Escape the next character
            if i < n:
                regex += re.escape(pattern[i])
                i += 1
                match_type = _MatchType.REGEX
            else:
                regex += "\\\\"
        else:
            regex += ch

    if match_type is _MatchType.EXACT:
        return lambda path: path == pattern
    if match_type is _MatchType.PREFIX:
        prefix = pattern[:-2]
        return lambda path: path.startswith(prefix)
    if match_type is _MatchType.SUFFIX:
        suffix = pattern[2:]
        # "**/foo" also matches "foo"
        return lambda path: path.endswith(suffix) or (
            suffix.startswith("/") and path == suffix[1:]
        )
    compiled = re.compile(regex + r"\Z")
    return lambda path: compiled.match(path) is not None


class _Pattern:
    def __init__(
        self, cleaned_pattern: str, exclusion: bool, backslash_is_escape: bool
    ):
        self.exclusion = exclusion
        self.dirs = cleaned_pattern.split("/")
        self.match = _compile(cleaned_pattern, backslash_is_escape)


class PatternMatcher:
    """
    Match paths relative to the context root against `.dockerignore` patterns.

    A pattern that matches a directory excludes everything under it, a leading
    `/` is ignored, and `!` patterns re-include paths (the last matching
    pattern wins).

    :param patterns: Patterns in `.dockerignore` syntax
    :param backslash_is_separator: Whether `\\` separates path segments
        (as on Windows) instead of escaping the next character in a pattern
    :raises ValueError: If a pattern is invalid, such as an unterminated `[`
    """

    def __init__(self, patterns: List[str], backslash_is_separator: bool = False):
        self._patterns: List[_Pattern] = []
        self._cleaned: List[str] = []
        self._backslash_is_separator = backslash_is_separator
        for original in patterns:
            if original.startswith("#"):
                continue
            pattern = original.strip()
            if not pattern:
                continue
            exclusion = pattern.startswith("!")
            if exclusion:
                pattern = pattern[1:].strip()
                if not pattern:
                    raise ValueError(
                        f"Invalid ignore pattern '{original}': illegal exclusion pattern"
                    )
            if backslash_is_separator:
                pattern = pattern.replace("\\", "/")
            pattern = _clean(pattern)
            if len(pattern) > 1 and pattern.startswith("/"):
                pattern = pattern[1:]
            try:
                self._patterns.append(
                    _Pattern(pattern, exclusion, not backslash_is_separator)
                )
            except (re.error, ValueError) as e:
                raise ValueError(f"Invalid ignore pattern '{original}': {e}") from e
            self._cleaned.append(("!" if exclusion else "") + pattern)

    @property
    def patterns(self) -> List[str]:
        """
        The cleaned patterns, `!` prefixed for exclusions. Empty lines and
        comments are dropped.
        """
        return list(self._cleaned)

    def _to_slash(self, path: str) -> str:
        return path.replace("\\", "/") if self._backslash_is_separator else path

    def matches(self, path: str) -> bool:
        """
        Whether the path is excluded. Like BuildKit, the patterns are evaluated
        on each parent directory first, and a pattern that matched a parent
        directory also matches the paths under it.

        :param path: Slash-separated path relative to the context root
        :return: True if the path is excluded
        """
        segments = self._to_slash(path).split("/")
        parent_matched: List[bool] = []
        matched = False
        for depth in range(1, len(segments) + 1):
            current = "/".join(segments[:depth])
            current_matched: List[bool] = []
            matched = False
            for i, pattern in enumerate(self._patterns):
                match = bool(parent_matched) and parent_matched[i]
                if not match:
                    # An inclusion can't change an already matched path, and
                    # an exclusion can't change a path that hasn't matched yet
                    if pattern.exclusion != matched:
                        current_matched.append(False)
                        continue
                    match = pattern.match(current)
                current_matched.append(match)
                if match:
                    matched = not pattern.exclusion
            parent_matched = current_matched
        return matched

    def may_match_under(self, dir_path: str) -> bool:
        """
        Whether a `!` pattern could re-include a path under the directory,
        in which case an excluded directory must still be walked.

        :param dir_path: Slash-separated directory path relative to the context root
        :return: True if a path under the directory could be re-included
        """
        dir_segments = self._to_slash(dir_path).split("/")
        for pattern in self._patterns:
            if pattern.exclusion and self._may_match_under(pattern, dir_segments):
                return True
        return False

    @staticmethod
    def _may_match_under(pattern: _Pattern, dir_segments: List[str]) -> bool:
        for i, dir_segment in enumerate(dir_segments):
            if i >= len(pattern.dirs):
                return False
            segment = pattern.dirs[i]
            if "**" in segment:
                return True
            if not _WILDCARD_CHARS.search(segment) and segment != dir_segment:
                return False
        return len(pattern.dirs) > len(dir_segments)
