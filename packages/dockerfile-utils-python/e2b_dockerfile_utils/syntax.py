"""
Dockerfile syntax parser.

Port of BuildKit's ``frontend/dockerfile/parser`` (https://github.com/moby/buildkit):
handles parser directives (``# escape=``), comments, line continuations,
builder flags (``--chown=...``), JSON/exec forms and heredocs.
"""

import json
import re
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Set, Tuple

from e2b_dockerfile_utils.lexer import ShellLex, is_space


@dataclass
class DockerfileHeredoc:
    name: str
    # Raw content including trailing newlines of every line.
    content: str
    # `<<-`: leading tabs are stripped from content lines.
    chomp: bool
    # Unquoted terminator: content is subject to variable expansion.
    expand: bool
    file_descriptor: int


@dataclass
class DockerfileInstruction:
    # Upper-cased instruction keyword, e.g. `RUN`.
    name: str
    # The full (continuation-joined) instruction line.
    original: str
    # Builder flags, e.g. `--chown=user:group`, with quotes removed.
    flags: List[str]
    # Instruction arguments. For `ENV` and `LABEL` these are
    # `[key, value, delimiter, ...]` triples where delimiter is `=` or ``.
    args: List[str]
    # Arguments were given in JSON (exec) form.
    json: bool
    heredocs: List[DockerfileHeredoc]
    start_line: int
    end_line: int


@dataclass
class DockerfileWarning:
    message: str
    line: int


@dataclass
class DockerfileAst:
    instructions: List[DockerfileInstruction]
    escape_token: str
    warnings: List[DockerfileWarning] = field(default_factory=list)


class DockerfileSyntaxError(ValueError):
    def __init__(self, message: str, line: Optional[int] = None) -> None:
        self.line = line
        if line is None:
            super().__init__(f"Dockerfile parse error: {message}")
        else:
            super().__init__(f"Dockerfile parse error on line {line}: {message}")


_DEFAULT_ESCAPE_TOKEN = "\\"
_WHITESPACE = re.compile(r"[\t\v\f\r ]+")
_DIRECTIVE = re.compile(r"^#\s*([a-zA-Z][a-zA-Z0-9]*)\s*=\s*(.+?)\s*$")
_VALID_DIRECTIVES = {"syntax", "escape", "check"}
_HEREDOC_INSTRUCTIONS = {"ADD", "COPY", "RUN"}
_LINES = re.compile(r"[^\n]*\n|[^\n]+$")

ParsedArgs = Tuple[List[str], bool]
LineParser = Callable[[str, str], ParsedArgs]


def _trim_newline(line: str) -> str:
    return line.rstrip("\r\n")


def _trim_leading_whitespace(line: str) -> str:
    i = 0
    while i < len(line) and is_space(line[i]):
        i += 1
    return line[i:]


def _is_comment(line: str) -> bool:
    return _trim_leading_whitespace(line).startswith("#")


def _split_lines(content: str) -> List[str]:
    """Split into lines the way a `bufio.Scanner` with newline-preserving split does."""
    return _LINES.findall(content)


class _Directives:
    def __init__(self) -> None:
        self.escape_token = _DEFAULT_ESCAPE_TOKEN
        self._continuation = self._build_continuation_regex(_DEFAULT_ESCAPE_TOKEN)
        self._done = False
        self._seen: Set[str] = set()

    def possible_parser_directive(self, line: str) -> bool:
        """Returns ``True`` when the line was a parser directive."""
        if self._done:
            return False
        match = _DIRECTIVE.match(line)
        if not match:
            self._done = True
            return False
        key = match.group(1).lower()
        if key not in _VALID_DIRECTIVES:
            self._done = True
            return False
        if key in self._seen:
            raise ValueError(f"only one {key} parser directive can be used")
        self._seen.add(key)
        if key == "escape":
            self._set_escape_token(match.group(2))
        return True

    def trim_continuation(self, line: str) -> Tuple[str, bool]:
        """Returns the line without its continuation token and whether it ended."""
        if self._continuation.search(line):
            return self._continuation.sub(r"\1", line), False
        return line, True

    def _set_escape_token(self, token: str) -> None:
        if token not in ("`", "\\"):
            raise ValueError(f"invalid escape token '{token}' does not match ` or \\")
        self.escape_token = token
        self._continuation = self._build_continuation_regex(token)

    @staticmethod
    def _build_continuation_regex(token: str) -> "re.Pattern[str]":
        t = re.escape(token)
        # The escape token is a line continuation when it is the last
        # non-whitespace character and not itself escaped.
        return re.compile(f"([^{t}]){t}[ \\t]*$|^{t}[ \\t]*$")


def _parse_string(rest: str, _escape_token: str) -> ParsedArgs:
    return ([] if rest == "" else [rest]), False


def _parse_ignore(_rest: str, _escape_token: str) -> ParsedArgs:
    return [], False


def _parse_strings_whitespace_delimited(rest: str, _escape_token: str) -> ParsedArgs:
    if rest == "":
        return [], False
    return _WHITESPACE.split(rest), False


class _NotJsonArrayError(Exception):
    pass


class _NotStringArrayError(ValueError):
    pass


def _parse_json(rest: str) -> List[str]:
    rest = _trim_leading_whitespace(rest)
    if not rest.startswith("["):
        raise _NotJsonArrayError()
    try:
        parsed = json.loads(rest)
    except ValueError:
        raise _NotJsonArrayError() from None
    if not isinstance(parsed, list):
        raise _NotJsonArrayError()
    for item in parsed:
        if not isinstance(item, str):
            raise _NotStringArrayError("Only strings are supported in JSON arrays")
    return parsed


def _parse_maybe_json(rest: str, _escape_token: str) -> ParsedArgs:
    if rest == "":
        return [], False
    try:
        return _parse_json(rest), True
    except _NotJsonArrayError:
        return [rest], False


def _parse_health_config(rest: str, escape_token: str) -> ParsedArgs:
    # `HEALTHCHECK [flags] <type> <command>`: the type (`CMD`/`NONE`) is the
    # first argument, the command follows in JSON or shell form
    sep = 0
    while sep < len(rest) and not is_space(rest[sep]):
        sep += 1
    nxt = sep
    while nxt < len(rest) and is_space(rest[nxt]):
        nxt += 1
    if sep == 0:
        return [], False
    args, is_json = _parse_maybe_json(rest[nxt:], escape_token)
    return [rest[:sep], *args], is_json


def _parse_maybe_json_to_list(rest: str, escape_token: str) -> ParsedArgs:
    try:
        return _parse_json(rest), True
    except _NotJsonArrayError:
        return _parse_strings_whitespace_delimited(rest, escape_token)


def parse_words(rest: str, escape_token: str) -> List[str]:
    """
    Split a line into whitespace separated words, keeping quotes and escape
    characters in place (they are resolved later by the shell lexer).
    """
    words: List[str] = []
    phase = "spaces"
    quote = ""
    blank_ok = False
    word: List[str] = []
    length = len(rest)
    pos = 0

    while pos <= length:
        ch = rest[pos] if pos < length else ""

        if phase == "spaces":
            if pos == length:
                break
            if is_space(ch):
                pos += 1
                continue
            phase = "word"
        if pos == length:
            if blank_ok or word:
                words.append("".join(word))
            break
        if phase == "word":
            if is_space(ch):
                phase = "spaces"
                if blank_ok or word:
                    words.append("".join(word))
                word = []
                blank_ok = False
                pos += 1
                continue
            if ch in ("'", '"'):
                quote = ch
                blank_ok = True
                phase = "quote"
            if ch == escape_token:
                if pos + 1 == length:
                    pos += 1
                    continue  # skip an escape token at end of line
                # outside quotes an escape token always keeps itself and the
                # following character, even if that character is a quote
                word.append(ch)
                pos += 1
                word.append(rest[pos])
                pos += 1
                continue
            word.append(ch)
            pos += 1
            continue
        # phase == "quote"
        if ch == quote:
            phase = "word"
        if ch == escape_token and quote != "'":
            if pos + 1 == length:
                phase = "word"
                pos += 1
                continue  # skip the escape token at end
            word.append(ch)
            pos += 1
            word.append(rest[pos])
            pos += 1
            continue
        word.append(ch)
        pos += 1

    return words


def _parse_maybe_json_to_words(rest: str, escape_token: str) -> ParsedArgs:
    """
    Like ``_parse_maybe_json_to_list``, but the shell form is split with quote
    awareness so that ``COPY "my file.txt" /dest/`` works (Docker only
    supports such paths in JSON form).
    """
    try:
        return _parse_json(rest), True
    except _NotJsonArrayError:
        return parse_words(rest, escape_token), False


def _parse_name_or_name_val(rest: str, escape_token: str) -> ParsedArgs:
    return parse_words(rest, escape_token), False


def _parse_name_val(key: str) -> LineParser:
    def parse(rest: str, escape_token: str) -> ParsedArgs:
        words = parse_words(rest, escape_token)
        if not words:
            return [], False

        # Old format: KEY name value
        if "=" not in words[0]:
            match = _WHITESPACE.search(rest)
            if not match:
                raise ValueError(f"{key} must have two arguments")
            return [rest[: match.start()], rest[match.end() :], ""], False

        args: List[str] = []
        for word in words:
            if "=" not in word:
                raise ValueError(
                    f'Syntax error - can\'t find = in "{word}". Must be of the form: name=value'
                )
            name, value = word.split("=", 1)
            args.extend([name, value, "="])
        return args, False

    return parse


_LINE_PARSERS: Dict[str, LineParser] = {
    "ADD": _parse_maybe_json_to_words,
    "ARG": _parse_name_or_name_val,
    "CMD": _parse_maybe_json,
    "COPY": _parse_maybe_json_to_words,
    "ENTRYPOINT": _parse_maybe_json,
    "ENV": _parse_name_val("ENV"),
    "EXPOSE": _parse_strings_whitespace_delimited,
    "FROM": _parse_strings_whitespace_delimited,
    "HEALTHCHECK": _parse_health_config,
    "LABEL": _parse_name_val("LABEL"),
    "MAINTAINER": _parse_string,
    "ONBUILD": _parse_ignore,
    "RUN": _parse_maybe_json,
    "SHELL": _parse_maybe_json,
    "STOPSIGNAL": _parse_string,
    "USER": _parse_string,
    "VOLUME": _parse_maybe_json_to_list,
    "WORKDIR": _parse_string,
}


def _extract_builder_flags(line: str, escape_token: str) -> Tuple[str, List[str]]:
    """Parses leading ``--flag[=value]`` words. Returns the remaining line and flags."""
    flags: List[str] = []
    phase = "spaces"
    quote = ""
    blank_ok = False
    word: List[str] = []
    length = len(line)
    pos = 0

    while pos <= length:
        ch = line[pos] if pos < length else ""

        if phase == "spaces":
            if pos == length:
                break
            if is_space(ch):
                pos += 1
                continue
            # only keep going if the next word starts with --
            if ch != "-" or pos + 1 == length or line[pos + 1] != "-":
                return line[pos:], flags
            phase = "word"
        if pos == length:
            joined = "".join(word)
            if joined != "--" and (blank_ok or word):
                flags.append(joined)
            break
        if phase == "word":
            if is_space(ch):
                phase = "spaces"
                joined = "".join(word)
                if joined == "--":
                    return line[pos:], flags
                if blank_ok or word:
                    flags.append(joined)
                word = []
                blank_ok = False
                pos += 1
                continue
            if ch in ("'", '"'):
                quote = ch
                blank_ok = True
                phase = "quote"
                pos += 1
                continue
            if ch == escape_token:
                if pos + 1 == length:
                    pos += 1
                    continue
                pos += 1
                word.append(line[pos])
                pos += 1
                continue
            word.append(ch)
            pos += 1
            continue
        # phase == "quote"
        if ch == quote:
            phase = "word"
            pos += 1
            continue
        if ch == escape_token:
            if pos + 1 == length:
                phase = "word"
                pos += 1
                continue
            pos += 1
            word.append(line[pos])
            pos += 1
            continue
        word.append(ch)
        pos += 1

    return "", flags


def _split_command(line: str, escape_token: str) -> Tuple[str, List[str], str]:
    trimmed = line.strip()
    match = _WHITESPACE.search(trimmed)
    if not match:
        return trimmed, [], ""
    command = trimmed[: match.start()]
    rest, flags = _extract_builder_flags(trimmed[match.end() :], escape_token)
    return command, flags, rest.strip()


def _match_heredoc_marker(word: str) -> Optional[Tuple[str, bool, str]]:
    """Split ``[fd]<<[-]name`` into its parts without a backtracking regex."""
    i = 0
    while i < len(word) and word[i].isdigit():
        i += 1
    if not word.startswith("<<", i):
        return None
    file_descriptor = word[:i]
    i += 2
    chomp = i < len(word) and word[i] == "-"
    if chomp:
        i += 1
    while i < len(word) and word[i].isspace():
        i += 1
    rest = word[i:]
    if "<" in rest:
        return None
    return file_descriptor, chomp, rest


def parse_heredoc(word: str) -> Optional[DockerfileHeredoc]:
    match = _match_heredoc_marker(word)
    if match is None:
        return None
    fd, chomp, rest = match
    file_descriptor = int(fd) if fd else 0
    if not rest:
        return None

    # Lex the terminator both with and without quotes. If the results
    # differ, part of the word was quoted and the content must not expand.
    words = ShellLex("\\").process_words(rest)
    if len(words) != 1:
        return None
    words_raw = ShellLex("\\", raw_quotes=True).process_words(rest)
    if len(words_raw) != len(words):
        raise ValueError(
            f"internal lexing of heredoc produced inconsistent results: {rest}"
        )

    def count_quotes(s: str) -> int:
        return s.count("'") + s.count('"')

    expand = count_quotes(words[0]) == count_quotes(words_raw[0])
    return DockerfileHeredoc(
        name=words[0],
        content="",
        chomp=chomp,
        expand=expand,
        file_descriptor=file_descriptor,
    )


def _heredocs_from_line(line: str) -> List[DockerfileHeredoc]:
    try:
        words = ShellLex("\\", raw_quotes=True, raw_escapes=True).process_words(line)
    except ValueError:
        return []
    heredocs: List[DockerfileHeredoc] = []
    for word in words:
        heredoc = parse_heredoc(word)
        if heredoc is not None:
            heredocs.append(heredoc)
    return heredocs


def chomp_heredoc_content(content: str) -> str:
    """Strips leading tabs from every line (``<<-`` heredocs)."""
    return re.sub(r"^\t+", "", content, flags=re.MULTILINE)


def parse_dockerfile_ast(content: str) -> DockerfileAst:
    directives = _Directives()
    if content.startswith("\ufeff"):
        content = content[1:]
    lines = _split_lines(content)
    instructions: List[DockerfileInstruction] = []
    warnings: List[DockerfileWarning] = []

    current_line = 0
    index = 0

    def process_line(raw: str, strip_left_whitespace: bool) -> str:
        line = _trim_newline(raw)
        if strip_left_whitespace:
            line = _trim_leading_whitespace(line)
        try:
            directives.possible_parser_directive(line)
        except ValueError as err:
            raise DockerfileSyntaxError(str(err), current_line + 1) from None
        return "" if _is_comment(line) else line

    while index < len(lines):
        raw = lines[index]
        index += 1
        line = process_line(raw, True)
        current_line += 1
        start_line = current_line

        line, is_end_of_line = directives.trim_continuation(line)
        if is_end_of_line and not line:
            continue

        has_empty_continuation_line = False
        while not is_end_of_line and index < len(lines):
            continuation_raw = lines[index]
            index += 1
            continuation = process_line(continuation_raw, False)
            current_line += 1

            if _is_comment(continuation_raw):
                continue
            if not _trim_leading_whitespace(_trim_newline(continuation_raw)):
                has_empty_continuation_line = True
                continue

            trimmed, is_end_of_line = directives.trim_continuation(continuation)
            line += trimmed

        if has_empty_continuation_line:
            warnings.append(
                DockerfileWarning(
                    message=f"Empty continuation line found in: {line}",
                    line=current_line,
                )
            )

        command, flags, rest = _split_command(line, directives.escape_token)
        name = command.upper()
        line_parser = _LINE_PARSERS.get(name)
        if line_parser is None:
            raise DockerfileSyntaxError(f"unknown instruction: {command}", start_line)

        try:
            args, is_json = line_parser(rest, directives.escape_token)
        except DockerfileSyntaxError:
            raise
        except ValueError as err:
            raise DockerfileSyntaxError(str(err), start_line) from None

        instruction = DockerfileInstruction(
            name=name,
            original=line,
            flags=flags,
            args=args,
            json=is_json,
            heredocs=[],
            start_line=start_line,
            end_line=current_line,
        )

        if name in _HEREDOC_INSTRUCTIONS and not is_json and "<<" in line:
            try:
                heredocs = _heredocs_from_line(line)
            except ValueError as err:
                raise DockerfileSyntaxError(str(err), start_line) from None
            for heredoc in heredocs:
                terminated = False
                content_lines: List[str] = []
                while index < len(lines):
                    heredoc_line = lines[index]
                    index += 1
                    current_line += 1

                    possible_terminator = _trim_newline(heredoc_line)
                    if heredoc.chomp:
                        possible_terminator = possible_terminator.lstrip("\t")
                    if possible_terminator == heredoc.name:
                        terminated = True
                        break
                    content_lines.append(heredoc_line)
                if not terminated:
                    raise DockerfileSyntaxError("unterminated heredoc", start_line)
                heredoc.content = "".join(content_lines)
                instruction.heredocs.append(heredoc)
            instruction.end_line = current_line

        instructions.append(instruction)

    return DockerfileAst(
        instructions=instructions,
        escape_token=directives.escape_token,
        warnings=warnings,
    )
