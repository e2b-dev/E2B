"""
Shell-style word lexer for Dockerfile instruction arguments.

This is a port of BuildKit's ``frontend/dockerfile/shell`` lexer
(https://github.com/moby/buildkit). Variable references (``$VAR``,
``${VAR:-default}``, ...) are expanded from the ``env`` mapping; without it
they are kept verbatim, so they can be evaluated later inside the sandbox.
"""

import re
import unicodedata
from typing import Callable, List, Mapping, Optional, Tuple

_SPECIAL_PARAMS = "@*#?-$!0"
_ASCII_SPACES = " \t\n\v\f\r\x85\xa0"


def is_space(ch: str) -> bool:
    """Equivalent of Go's ``unicode.IsSpace``."""
    return ch in _ASCII_SPACES or unicodedata.category(ch).startswith("Z")


def _is_letter(ch: str) -> bool:
    return ch.isalpha()


def _is_digit(ch: str) -> bool:
    return ch.isdecimal()


class _Scanner:
    def __init__(self, text: str) -> None:
        self._chars = text
        self._pos = 0

    def peek(self) -> Optional[str]:
        if self._pos < len(self._chars):
            return self._chars[self._pos]
        return None

    def next(self) -> Optional[str]:
        if self._pos < len(self._chars):
            ch = self._chars[self._pos]
            self._pos += 1
            return ch
        return None


class _Words:
    def __init__(self) -> None:
        self._words: List[str] = []
        self._buf: List[str] = []
        self._in_word = False

    def add_char(self, ch: str) -> None:
        if is_space(ch) and self._in_word:
            if self._buf:
                self._words.append("".join(self._buf))
                self._buf = []
                self._in_word = False
        elif not is_space(ch):
            self.add_raw_char(ch)

    def add_raw_char(self, ch: str) -> None:
        self._buf.append(ch)
        self._in_word = True

    def add_string(self, text: str) -> None:
        for ch in text:
            self.add_char(ch)

    def add_raw_string(self, text: str) -> None:
        self._buf.append(text)
        self._in_word = True

    def get_words(self) -> List[str]:
        if self._buf:
            self._words.append("".join(self._buf))
            self._buf = []
            self._in_word = False
        return self._words


class ShellLex:
    def __init__(
        self,
        escape_token: str,
        raw_quotes: bool = False,
        raw_escapes: bool = False,
        skip_process_quotes: bool = False,
        env: Optional[Mapping[str, str]] = None,
        skip_unset_env: bool = True,
    ) -> None:
        """
        :param escape_token: Escape character (``\\`` or `````)
        :param raw_quotes: Keep quote characters in the output instead of removing them
        :param raw_escapes: Keep escape characters in the output instead of removing them
        :param skip_process_quotes: Do not treat quote characters specially at all
        :param env: Variables to expand. Defaults to no variables
        :param skip_unset_env: Keep references to variables missing from ``env``
            verbatim instead of expanding them to an empty string
        """
        self._escape_token = escape_token
        self._raw_quotes = raw_quotes
        self._raw_escapes = raw_escapes
        self._skip_process_quotes = skip_process_quotes
        self._env: Mapping[str, str] = env if env is not None else {}
        self._skip_unset_env = skip_unset_env

    def process_word(self, word: str) -> str:
        """Process a single word: remove quotes/escapes, keep whitespace."""
        return self._process(word)[0]

    def process_words(self, word: str) -> List[str]:
        """Process a line into whitespace separated words, honoring quotes."""
        return self._process(word)[1]

    def _process(self, word: str) -> Tuple[str, List[str]]:
        sw = _ShellWord(
            _Scanner(word),
            self._escape_token,
            self._raw_quotes,
            self._raw_escapes,
            self._skip_process_quotes,
            self._env,
            self._skip_unset_env,
        )
        try:
            return sw.process_stop_on(None, self._raw_escapes)
        except (ValueError, RecursionError) as err:
            raise ValueError(f"failed to process {word!r}: {err}") from None


class _ShellWord:
    def __init__(
        self,
        scanner: _Scanner,
        escape_token: str,
        raw_quotes: bool,
        raw_escapes: bool,
        skip_process_quotes: bool,
        env: Mapping[str, str],
        skip_unset_env: bool,
    ) -> None:
        self._scanner = scanner
        self._escape_token = escape_token
        self._raw_quotes = raw_quotes
        self._raw_escapes = raw_escapes
        self._skip_process_quotes = skip_process_quotes
        self._env = env
        self._skip_unset_env = skip_unset_env

    def process_stop_on(
        self, stop_char: Optional[str], raw_escapes: bool
    ) -> Tuple[str, List[str]]:
        result: List[str] = []
        words = _Words()

        previous_raw_escapes = self._raw_escapes
        self._raw_escapes = raw_escapes
        try:
            while True:
                ch = self._scanner.peek()
                if ch is None:
                    break

                if stop_char is not None and ch == stop_char:
                    self._scanner.next()
                    return "".join(result), words.get_words()

                fn = self._special_handler(ch)
                if fn is not None:
                    tmp = fn()
                    result.append(tmp)
                    if ch == "$":
                        words.add_string(tmp)
                    else:
                        words.add_raw_string(tmp)
                    continue

                ch = self._scanner.next()
                assert ch is not None
                if ch == self._escape_token:
                    if self._raw_escapes:
                        words.add_raw_char(ch)
                        result.append(ch)

                    # the escape token escapes the next character, except at end of line
                    nxt = self._scanner.next()
                    if nxt is None:
                        break
                    ch = nxt
                    words.add_raw_char(ch)
                else:
                    words.add_char(ch)
                result.append(ch)
        finally:
            self._raw_escapes = previous_raw_escapes

        if stop_char is not None:
            raise ValueError(
                f"unexpected end of statement while looking for matching {stop_char}"
            )
        return "".join(result), words.get_words()

    def _special_handler(self, ch: str) -> Optional[Callable[[], str]]:
        if ch == "$":
            return self._process_dollar
        if ch == "<":
            return self._process_possible_heredoc
        if ch == "'" and not self._skip_process_quotes:
            return self._process_single_quote
        if ch == '"' and not self._skip_process_quotes:
            return self._process_double_quote
        return None

    def _process_single_quote(self) -> str:
        # All chars between single quotes are taken as-is; a single quote
        # cannot be escaped inside single quotes.
        result: List[str] = []
        ch = self._scanner.next()
        assert ch is not None
        if self._raw_quotes:
            result.append(ch)

        while True:
            ch = self._scanner.next()
            if ch is None:
                raise ValueError(
                    "unexpected end of statement while looking for matching single-quote"
                )
            if ch == "'":
                if self._raw_quotes:
                    result.append(ch)
                return "".join(result)
            result.append(ch)

    def _process_double_quote(self) -> str:
        # All chars up to the next " are taken as-is, even ', except `$`.
        # The escape token only escapes `"`, `$` and itself.
        result: List[str] = []
        opening = self._scanner.next()
        assert opening is not None
        if self._raw_quotes:
            result.append(opening)

        while True:
            peeked = self._scanner.peek()
            if peeked is None:
                raise ValueError(
                    "unexpected end of statement while looking for matching double-quote"
                )
            if peeked == '"':
                ch = self._scanner.next()
                assert ch is not None
                if self._raw_quotes:
                    result.append(ch)
                return "".join(result)
            if peeked == "$":
                result.append(self._process_dollar())
                continue

            ch = self._scanner.next()
            assert ch is not None
            if ch == self._escape_token:
                if self._raw_escapes:
                    result.append(ch)
                after = self._scanner.peek()
                if after is None:
                    # ignore escape token at end of word
                    continue
                if after in ('"', "$", self._escape_token):
                    ch = self._scanner.next()
                    assert ch is not None
            result.append(ch)

    def _process_dollar(self) -> str:
        self._scanner.next()  # '$'

        if self._scanner.peek() != "{":
            name = self._process_name()
            if name == "":
                return "$"
            value = self._env.get(name)
            if value is None and self._skip_unset_env:
                return "$" + name
            return value or ""

        self._scanner.next()  # '{'
        first = self._scanner.peek()
        if first is None:
            raise ValueError("syntax error: missing '}'")
        if first in ("{", "}", ":"):
            raise ValueError("syntax error: bad substitution")

        name = self._process_name()
        ch = self._scanner.next()
        if ch is None:
            raise ValueError("syntax error: missing '}'")
        chs = ch
        value = self._env.get(name)

        if ch == "}":
            if value is None and self._skip_unset_env:
                return "${" + name + "}"
            return value or ""

        null_is_unset = False
        if ch == ":":
            null_is_unset = True
            modifier = self._scanner.next()
            if modifier is None:
                raise ValueError("syntax error: missing '}'")
            ch = modifier
            chs += ch

        if not null_is_unset:
            if ch == "/":
                return self._process_dollar_replace(name)
            if ch not in "+-?#%":
                raise ValueError(f"unsupported modifier ({chs}) in substitution")

        raw_escapes = ch in ("#", "%")
        if null_is_unset and raw_escapes:
            raise ValueError(f"unsupported modifier ({chs}) in substitution")
        word = self._process_stop_on_or_missing_brace("}", raw_escapes)
        if value is None and self._skip_unset_env:
            return "${" + name + chs + word + "}"

        unset = value is None or (null_is_unset and value == "")
        if ch == "-":
            return word if unset else (value or "")
        if ch == "+":
            return "" if unset else word
        if ch == "?":
            if value is None:
                raise ValueError(f"{name}: {word or 'is not allowed to be unset'}")
            if unset:
                raise ValueError(f"{name}: {word or 'is not allowed to be empty'}")
            return value
        if ch in ("#", "%"):
            # `#`/`%` remove the shortest match, `##`/`%%` the longest
            greedy = word.startswith(ch)
            pattern = word[1:] if greedy else word
            if ch == "%":
                return _trim_suffix(pattern, value or "", greedy)
            return _trim_prefix(pattern, value or "", greedy)
        raise ValueError(f"unsupported modifier ({chs}) in substitution")

    def _process_dollar_replace(self, name: str) -> str:
        op = "/"
        if self._scanner.peek() == "/":
            self._scanner.next()
            op = "//"
        try:
            pattern = self.process_stop_on("/", True)[0]
        except ValueError:
            if self._scanner.peek() is None:
                raise ValueError("syntax error: missing '/' in ${}") from None
            raise
        replacement = self._process_stop_on_or_missing_brace("}", True)

        value = self._env.get(name)
        if value is None and self._skip_unset_env:
            return "${" + name + op + pattern + "/" + replacement + "}"
        regex = _shell_pattern_to_regex(pattern, greedy=True, anchored=False)
        return regex.sub(
            lambda _: replacement, value or "", count=0 if op == "//" else 1
        )

    def _process_stop_on_or_missing_brace(
        self, stop_char: str, raw_escapes: bool
    ) -> str:
        try:
            return self.process_stop_on(stop_char, raw_escapes)[0]
        except ValueError:
            if self._scanner.peek() is None:
                raise ValueError("syntax error: missing '}'") from None
            raise

    def _process_name(self) -> str:
        # Read in a name (alphanumeric or _). A leading digit sequence or a
        # special parameter character is a complete name on its own.
        name: List[str] = []
        while True:
            ch = self._scanner.peek()
            if ch is None:
                break
            if not name and _is_digit(ch):
                digits: List[str] = []
                while True:
                    d = self._scanner.peek()
                    if d is None or not _is_digit(d):
                        break
                    digits.append(d)
                    self._scanner.next()
                return "".join(digits)
            if not name and ch in _SPECIAL_PARAMS:
                self._scanner.next()
                return ch
            if not _is_letter(ch) and not _is_digit(ch) and ch != "_":
                break
            name.append(ch)
            self._scanner.next()
        return "".join(name)

    def _process_possible_heredoc(self) -> str:
        self._scanner.next()  # '<'
        if self._scanner.peek() != "<":
            return "<"
        self._scanner.next()

        # a heredoc may have whitespace between `<<` and the terminator word
        space: List[str] = []
        while True:
            ch = self._scanner.peek()
            if ch not in ("\t", "\r", " "):
                break
            space.append(ch)
            self._scanner.next()
        return "<<" + "".join(space)


def _shell_pattern_to_regex(
    pattern: str, greedy: bool, anchored: bool
) -> "re.Pattern[str]":
    """Convert a shell wildcard pattern (``?`` one character, ``*`` the shortest
    or, when greedy, the longest run) to a regular expression. Bracket
    expressions are not supported, like in BuildKit.
    """
    out = "^" if anchored else ""
    star = ".*" if greedy else ".*?"
    i = 0
    while i < len(pattern):
        ch = pattern[i]
        i += 1
        if ch == "*":
            out += star
            continue
        if ch == "?":
            out += "."
            continue
        if ch == "\\":
            # `}` and `/` are escaped to be part of the `${}` word, the escape
            # itself is not part of the pattern
            nxt = pattern[i] if i < len(pattern) else ""
            if nxt in ("}", "/"):
                continue
            i += 1
            if nxt not in ("*", "?", "\\"):
                raise ValueError(
                    f"invalid pattern ({pattern}) in substitution: "
                    f"invalid escape '\\{nxt}'"
                )
            ch = nxt
        if ch in "[]{}.+()|^$*?\\":
            out += "\\"
        out += ch
    return re.compile(out)


def _trim_prefix(pattern: str, value: str, greedy: bool) -> str:
    return _shell_pattern_to_regex(pattern, greedy, anchored=True).sub("", value, 1)


def _reverse_pattern(pattern: str) -> str:
    """Reverse a pattern without turning ``a\\*c`` into ``c*\\a``."""
    out: List[str] = []
    i = 0
    while i < len(pattern):
        if pattern[i] == "\\" and i + 1 < len(pattern):
            out[0:0] = [pattern[i], pattern[i + 1]]
            i += 2
        else:
            out.insert(0, pattern[i])
            i += 1
    return "".join(out)


def _trim_suffix(pattern: str, value: str, greedy: bool) -> str:
    # regular expressions cannot find the shortest rightmost match, so both
    # the pattern and the value are reversed to turn it into a leftmost search
    return _trim_prefix(_reverse_pattern(pattern), value[::-1], greedy)[::-1]
