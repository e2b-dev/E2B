"""
Matching of `.dockerignore` patterns, following the semantics Docker uses to
filter the build context.

Port of the pattern matcher from moby/patternmatcher (Apache-2.0):
https://github.com/moby/patternmatcher
"""

import os
import posixpath
import re
from typing import List

from e2b.exceptions import TemplateException

# Characters that have a meaning in a regex but not in a Docker pattern
_LITERAL_REGEX_CHARS = set(".+()|{}$^")
_WILDCARD_CHARS = re.compile(r"[*?\[\\]")
_BACKSLASH_IS_SEPARATOR = os.sep == "\\"


def _clean(pattern: str) -> str:
    # Equivalent of Go's filepath.Clean followed by filepath.ToSlash
    if _BACKSLASH_IS_SEPARATOR:
        pattern = pattern.replace("\\", "/")
    return posixpath.normpath(re.sub("/+", "/", pattern))


def _compile(pattern: str) -> "re.Pattern[str]":
    # Moby treats a leading ** followed only by literals as a suffix match.
    suffix = pattern[2:]
    if (
        pattern.startswith("**")
        and not pattern.startswith("**/")
        and not _WILDCARD_CHARS.search(suffix)
        and "]" not in suffix
    ):
        return re.compile("^.*" + re.escape(suffix) + "$")

    regex = "^"
    i, n = 0, len(pattern)
    while i < n:
        ch = pattern[i]
        i += 1
        if ch == "*":
            if i < n and pattern[i] == "*":
                i += 1
                # Treat "**/" as "**"
                if i < n and pattern[i] == "/":
                    i += 1
                regex += ".*" if i >= n else "(.*/)?"
            else:
                regex += "[^/]*"
        elif ch == "?":
            regex += "[^/]"
        elif ch == "[":
            # Copy a bracket expression as is, a leading "^" negates it
            j = i
            if j < n and pattern[j] == "^":
                j += 1
            while j < n and pattern[j] != "]":
                if pattern[j] == "\\" and not _BACKSLASH_IS_SEPARATOR:
                    j += 1
                j += 1
            regex += pattern[i - 1 : j + 1]
            i = j + 1
        elif ch in _LITERAL_REGEX_CHARS:
            regex += "\\" + ch
        elif ch == "\\" and not _BACKSLASH_IS_SEPARATOR:
            # Escape the next character
            if i < n:
                regex += re.escape(pattern[i])
                i += 1
            else:
                regex += "\\\\"
        else:
            regex += ch
    return re.compile(regex + "$")


class _Pattern:
    def __init__(self, cleaned_pattern: str, exclusion: bool):
        self.exclusion = exclusion
        self.dirs = cleaned_pattern.split("/")
        self._regex = _compile(cleaned_pattern)

    def match(self, path: str) -> bool:
        return self._regex.match(path) is not None


class PatternMatcher:
    """
    Match paths relative to the context root against `.dockerignore` patterns.

    A pattern that matches a directory excludes everything under it, a leading
    `/` is ignored, and `!` patterns re-include paths (the last matching
    pattern wins).
    """

    def __init__(self, patterns: List[str]):
        self._patterns: List[_Pattern] = []
        for original in patterns:
            pattern = original.strip()
            if not pattern or pattern.startswith("#"):
                continue
            exclusion = pattern.startswith("!")
            if exclusion:
                pattern = pattern[1:].strip()
                if not pattern:
                    continue
            pattern = _clean(pattern)
            if len(pattern) > 1 and pattern.startswith("/"):
                pattern = pattern[1:]
            try:
                self._patterns.append(_Pattern(pattern, exclusion))
            except re.error as e:
                raise TemplateException(
                    f"Invalid ignore pattern '{original}': {e}"
                ) from e

    def matches(self, path: str) -> bool:
        """
        Whether the path or one of its parent directories is excluded.

        :param path: Slash-separated path relative to the context root
        :return: True if the path is excluded
        """
        parent_path = posixpath.dirname(path)
        parent_dirs = parent_path.split("/") if parent_path else []

        matched = False
        for pattern in self._patterns:
            # An inclusion can't change an already matched path, and an
            # exclusion can't change a path that hasn't matched yet
            if pattern.exclusion != matched:
                continue
            match = pattern.match(path) or any(
                pattern.match("/".join(parent_dirs[: i + 1]))
                for i in range(len(parent_dirs))
            )
            if match:
                matched = not pattern.exclusion
        return matched

    def may_match_under(self, dir_path: str) -> bool:
        """
        Whether a `!` pattern could re-include a path under the directory,
        in which case an excluded directory must still be walked.

        :param dir_path: Slash-separated directory path relative to the context root
        :return: True if a path under the directory could be re-included
        """
        dir_segments = dir_path.split("/")
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
