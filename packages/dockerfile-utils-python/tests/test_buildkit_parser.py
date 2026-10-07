import unicodedata
from pathlib import Path
from typing import List

import pytest

from e2b_dockerfile_utils import (
    DockerfileHeredoc,
    DockerfileInstruction,
    DockerfileSyntaxError,
    chomp_heredoc_content,
    parse_dockerfile_ast,
    parse_heredoc,
    parse_words,
)

# Port of BuildKit's `frontend/dockerfile/parser` tests, see
# `fixtures/buildkit/README.md`.

FIXTURES = Path(__file__).parent / "fixtures" / "buildkit" / "parser"

_GO_ESCAPES = {
    '"': '\\"',
    "\\": "\\\\",
    "\a": "\\a",
    "\b": "\\b",
    "\f": "\\f",
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\v": "\\v",
}


def go_quote(s: str) -> str:
    """`strconv.Quote`"""
    out = '"'
    for ch in s:
        if ch in _GO_ESCAPES:
            out += _GO_ESCAPES[ch]
        elif ch == " " or unicodedata.category(ch)[0] in "LMNPS":
            out += ch
        else:
            cp = ord(ch)
            if cp < 0x80:
                out += f"\\x{cp:02x}"
            elif cp < 0x10000:
                out += f"\\u{cp:04x}"
            else:
                out += f"\\U{cp:08x}"
    return out + '"'


def dump(instruction: DockerfileInstruction) -> str:
    """The flat equivalent of BuildKit's `Node.Dump()`"""
    text = instruction.name.lower()
    if instruction.flags:
        text += " [" + " ".join(go_quote(f) for f in instruction.flags) + "]"
    if instruction.name == "ONBUILD":
        # BuildKit parses the trigger as a child node
        rest = instruction.original.split(None, 1)[1]
        child = parse_dockerfile_ast(rest).instructions[0]
        return f"({text} {dump(child)})"
    for arg in instruction.args:
        text += " " + go_quote(arg)
    return f"({text})"


def dump_all(content: str) -> str:
    return "\n".join(dump(i) for i in parse_dockerfile_ast(content).instructions)


def read(*parts: str) -> str:
    return FIXTURES.joinpath(*parts).read_text(encoding="utf-8")


# BuildKit splits shell-form ADD/COPY on whitespace only, this parser honors
# quotes so `COPY "a b" /dst` works, which changes the result for the
# unbalanced `ADD \\conf\\\\" /.znc`
_DEVIATIONS = {"escapes"}


@pytest.mark.parametrize(
    "case", sorted(p.name for p in (FIXTURES / "testfiles").iterdir())
)
def test_parse_cases(case: str):
    if case in _DEVIATIONS:
        pytest.skip("ADD/COPY words are quote-aware here")
    dockerfile = read("testfiles", case, "Dockerfile")
    expected = read("testfiles", case, "result")
    assert dump_all(dockerfile) == expected.strip()


# BuildKit reports "file with no instructions" for these; an empty instruction
# list is returned here instead
_EMPTY = {"empty_dockerfile", "only_comments"}


@pytest.mark.parametrize(
    "case", sorted(p.name for p in (FIXTURES / "testfiles-negative").iterdir())
)
def test_parse_error_cases(case: str):
    dockerfile = read("testfiles-negative", case, "Dockerfile")
    if case in _EMPTY:
        assert parse_dockerfile_ast(dockerfile).instructions == []
        return
    with pytest.raises(DockerfileSyntaxError):
        parse_dockerfile_ast(dockerfile)


def test_parse_includes_line_numbers():
    instructions = parse_dockerfile_ast(
        read("testfile-line", "Dockerfile")
    ).instructions
    assert [(i.start_line, i.end_line) for i in instructions] == [
        (5, 5),
        (11, 12),
        (17, 31),
    ]


def test_parse_warns_on_empty_continuation_line():
    dockerfile = """
FROM alpine:3.6

RUN valid \\
    continuation

RUN something \\

    following \\

    more

RUN another \\

    thing

RUN non-indented \\
# this is a comment
   after-comment

RUN indented \\
    # this is an indented comment
    comment
\t"""
    warnings = parse_dockerfile_ast(dockerfile).warnings
    assert len(warnings) == 2
    assert "Empty continuation line found in" in warnings[0].message
    assert "RUN something     following     more" in warnings[0].message
    assert "RUN another     thing" in warnings[1].message


@pytest.mark.parametrize(
    ("line", "expected"),
    [
        ("foo", ["foo"]),
        ("foo bar", ["foo", "bar"]),
        ("foo\\ bar", ["foo\\ bar"]),
        ("foo=bar", ["foo=bar"]),
        ("foo bar 'abc xyz'", ["foo", "bar", "'abc xyz'"]),
        ('foo bar "abc xyz"', ["foo", "bar", '"abc xyz"']),
        ("àöû", ["àöû"]),
        ('föo bàr "âbc xÿz"', ["föo", "bàr", '"âbc xÿz"']),
    ],
)
def test_parse_words(line: str, expected: List[str]):
    assert parse_words(line, "\\") == expected


@pytest.mark.parametrize(
    ("json_text", "expected"),
    [
        ("[]", []),
        ('[""]', [""]),
        ('["a"]', ["a"]),
        ('["a","b"]', ["a", "b"]),
        ('[ "a", "b" ]', ["a", "b"]),
        ('[\t"a",\t"b"\t]', ["a", "b"]),
        ('\t[\t"a",\t"b"\t]\t', ["a", "b"]),
        (
            '["abc 123", "♥", "☃", "\\" \\\\ \\/ \\b \\f \\n \\r \\t \\u0000"]',
            ["abc 123", "♥", "☃", '" \\ / \b \f \n \r \t \u0000'],
        ),
    ],
)
def test_json_arrays_of_strings(json_text: str, expected: List[str]):
    run = parse_dockerfile_ast(f"RUN {json_text}").instructions[0]
    assert run.json is True
    assert run.args == expected


@pytest.mark.parametrize(
    "json_text",
    [
        '["a",42,"b"]',
        '["a",123.456,"b"]',
        '["a",{},"b"]',
        '["a",{"c": "d"},"b"]',
        '["a",["c"],"b"]',
        '["a",true,"b"]',
        '["a",false,"b"]',
        '["a",null,"b"]',
    ],
)
def test_json_arrays_of_strings_invalid(json_text: str):
    with pytest.raises(
        DockerfileSyntaxError, match="Only strings are supported in JSON arrays"
    ):
        parse_dockerfile_ast(f"RUN {json_text}")


def test_parse_name_val_old_format():
    label = parse_dockerfile_ast("LABEL foo bar").instructions[0]
    assert label.args == ["foo", "bar", ""]


def test_parse_name_val_new_format():
    label = parse_dockerfile_ast("LABEL foo=bar thing=star").instructions[0]
    assert label.args == ["foo", "bar", "=", "thing", "star", "="]


def test_parse_name_val_without_val():
    with pytest.raises(DockerfileSyntaxError, match="ENV must have two arguments"):
        parse_dockerfile_ast("ENV foo")


def _heredoc(
    name: str,
    content: str,
    chomp: bool = False,
    expand: bool = True,
    file_descriptor: int = 0,
) -> DockerfileHeredoc:
    return DockerfileHeredoc(
        name=name,
        content=content,
        chomp=chomp,
        expand=expand,
        file_descriptor=file_descriptor,
    )


def test_parse_extracts_heredoc():
    # The upstream file has an `INVALID` line after `USER <<INVALID`, which
    # this parser rejects as an unknown instruction
    dockerfile = """
FROM alpine:3.6
ENV NAME=me
RUN ls
USER <<INVALID
RUN <<EMPTY
EMPTY
RUN 3<<EMPTY2
EMPTY2
RUN "<<NOHEREDOC"
RUN <<INDENT
\tfoo
\tbar
INDENT
RUN <<-UNINDENT
\tbaz
\tquux
UNINDENT
RUN <<-UNINDENT2
\tbaz
\tquux
\tUNINDENT2
RUN <<-EXPAND
\texpand $NAME
EXPAND
RUN <<-'NOEXPAND'
\tdon't expand $NAME
NOEXPAND
RUN <<COPY
echo hello world
echo foo bar
COPY
RUN <<COMMENT
# internal comment
echo hello world
echo foo bar # trailing comment
COMMENT
RUN --mount=type=cache,target=/foo <<MOUNT
echo hello
MOUNT
COPY <<FILE1 <<FILE2 /dest
content 1
FILE1
content 2
FILE2
COPY <<EOF /quotes
"foo"
'bar'
EOF
COPY <<X <<Y /dest
Y
X
X
Y
RUN <<COMPLEX python3
print('hello world')
COMPLEX
COPY <<file.txt /dest
hello world
file.txt
RUN <<eo'f'
echo foo
eof
RUN <<eo\\'f
echo foo
eo'f
RUN <<'e'o\\'f
echo foo
eo'f
RUN <<'one two'
echo bar
one two
RUN <<$EOF
$EOF
RUN <<  EOF
EOF
RUN <<  EOF  > foo
EOF
\t"""
    tests: List[List[DockerfileHeredoc]] = [
        [],  # ENV EXAMPLE=bla
        [],  # RUN ls
        [],  # USER <<INVALID
        [_heredoc("EMPTY", "")],
        [_heredoc("EMPTY2", "", file_descriptor=3)],
        [],  # RUN "<<NOHEREDOC"
        [_heredoc("INDENT", "\tfoo\n\tbar\n")],
        [_heredoc("UNINDENT", "\tbaz\n\tquux\n", chomp=True)],
        [_heredoc("UNINDENT2", "\tbaz\n\tquux\n", chomp=True)],
        [_heredoc("EXPAND", "\texpand $NAME\n", chomp=True)],
        [_heredoc("NOEXPAND", "\tdon't expand $NAME\n", chomp=True, expand=False)],
        [_heredoc("COPY", "echo hello world\necho foo bar\n")],
        [
            _heredoc(
                "COMMENT",
                "# internal comment\necho hello world\necho foo bar # trailing comment\n",
            )
        ],
        [_heredoc("MOUNT", "echo hello\n")],
        [_heredoc("FILE1", "content 1\n"), _heredoc("FILE2", "content 2\n")],
        [_heredoc("EOF", "\"foo\"\n'bar'\n")],
        [_heredoc("X", "Y\n"), _heredoc("Y", "X\n")],
        [_heredoc("COMPLEX", "print('hello world')\n")],
        [_heredoc("file.txt", "hello world\n")],
        [_heredoc("eof", "echo foo\n", expand=False)],
        [_heredoc("eo'f", "echo foo\n")],
        [_heredoc("eo'f", "echo foo\n", expand=False)],
        [_heredoc("one two", "echo bar\n", expand=False)],
        [_heredoc("$EOF", "")],
        [_heredoc("EOF", "")],
        [_heredoc("EOF", "")],
    ]
    instructions = parse_dockerfile_ast(dockerfile).instructions
    assert len(instructions) == len(tests) + 1
    for i, expected in enumerate(tests):
        assert instructions[i + 1].heredocs == expected


def test_parse_json_heredoc():
    dockerfile = """
FROM alpine:3.6
RUN ["whoami"]
RUN ["<<EOF"]
RUN ["<<'EOF'"]
\t"""
    instructions = parse_dockerfile_ast(dockerfile).instructions
    for i in range(1, 4):
        assert instructions[i].heredocs == []


def test_heredoc_chomp():
    assert chomp_heredoc_content("\thello\n\tworld\n") == "hello\nworld\n"


def test_parse_heredoc_helpers():
    valid_heredocs = [
        "<<EOF",
        "<<'EOF'",
        '<<"EOF"',
        "<<-EOF",
        "<<-'EOF'",
        '<<-"EOF"',
        '<<EO"F"',
        "<< EOF",
        "<<- EOF",
    ]
    invalid_heredocs = ["<<'EOF", '<<"EOF', "<<EOF'", '<<EOF"']
    not_heredocs = ["", "EOF", "<<", "<<-", "<EOF", "<<<EOF", "<<EOF sh"]

    for src in not_heredocs:
        assert parse_heredoc(src) is None, src
    for src in valid_heredocs:
        heredoc = parse_heredoc(src)
        assert heredoc is not None and heredoc.name == "EOF", src
    for src in invalid_heredocs:
        with pytest.raises(ValueError):
            parse_heredoc(src)


@pytest.mark.parametrize(
    ("line", "names"),
    [
        ("RUN <<EOF", ["EOF"]),
        ("RUN <<-EOF", ["EOF"]),
        ("RUN <<EOF", ["EOF"]),
        # upstream expects `EOF` here, but only asserts over the heredocs that
        # were found and BuildKit's lexer splits `<<-` and `EOF` into two words
        ("RUN <<- EOF", []),
        ("RUN << -EOF", ["-EOF"]),
        ("RUN <<'EOF'", ["EOF"]),
        ("RUN 4<<EOF", ["EOF"]),
        ("RUN <<EOF <<EOF2", ["EOF", "EOF2"]),
        ("RUN '<<EOF'", []),
        ('RUN "<<EOF"', []),
    ],
)
def test_heredocs_from_line(line: str, names: List[str]):
    dockerfile = "\n".join([line, *names, ""])
    run = parse_dockerfile_ast(dockerfile).instructions[0]
    assert [h.name for h in run.heredocs] == names


@pytest.mark.parametrize(
    ("dockerfile", "escape_token"),
    [
        ("#escape=\\\n# key = FOO bar\nFROM x", "\\"),
        ("# EScape=`\nFROM x", "`"),
    ],
)
def test_directives(dockerfile: str, escape_token: str):
    assert parse_dockerfile_ast(dockerfile).escape_token == escape_token
