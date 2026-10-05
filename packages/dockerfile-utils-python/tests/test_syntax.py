import pytest

from e2b_dockerfile_utils import (
    DockerfileHeredoc,
    DockerfileSyntaxError,
    chomp_heredoc_content,
    parse_dockerfile_ast,
    parse_heredoc,
    parse_words,
)


def test_upper_cases_instruction_names_and_keeps_argument_casing():
    ast = parse_dockerfile_ast("from node:24 as build\n")
    assert ast.escape_token == "\\"
    assert len(ast.instructions) == 1
    assert ast.instructions[0].name == "FROM"
    assert ast.instructions[0].args == ["node:24", "as", "build"]
    assert ast.instructions[0].json is False


def test_honours_the_escape_directive():
    ast = parse_dockerfile_ast("# escape=`\nFROM a\nRUN echo a `\n  b\n")
    assert ast.escape_token == "`"
    run = ast.instructions[1]
    assert run.args == ["echo a   b"]
    assert run.start_line == 3
    assert run.end_line == 4


def test_drops_comments_inside_continuations():
    ast = parse_dockerfile_ast(
        "FROM a\nRUN apt-get update \\\n  # comment\n  && apt-get install -y curl\n"
    )
    assert ast.instructions[1].args == ["apt-get update   && apt-get install -y curl"]


def test_parses_json_form():
    ast = parse_dockerfile_ast('FROM a\nCMD ["a", "b c"]\n')
    assert ast.instructions[1].json is True
    assert ast.instructions[1].args == ["a", "b c"]


def test_separates_builder_flags_from_arguments():
    ast = parse_dockerfile_ast("FROM a\nCOPY --chown=1:1 --chmod=755 a b /d\n")
    assert ast.instructions[1].flags == ["--chown=1:1", "--chmod=755"]
    assert ast.instructions[1].args == ["a", "b", "/d"]


def test_parses_env_key_value_and_legacy_forms_into_triples():
    ast = parse_dockerfile_ast('FROM a\nENV A=1 B="x y"\nENV LEGACY some value\n')
    assert ast.instructions[1].args == ["A", "1", "=", "B", '"x y"', "="]
    assert ast.instructions[2].args == ["LEGACY", "some value", ""]


def test_collects_heredocs():
    ast = parse_dockerfile_ast(
        "FROM a\nRUN <<EOF\necho hi\nEOF\nRUN <<-'EOT' cat\n\thi\nEOT\n"
    )
    _, first, second = ast.instructions
    assert first.args == ["<<EOF"]
    assert first.heredocs == [
        DockerfileHeredoc(
            name="EOF", content="echo hi\n", chomp=False, expand=True, file_descriptor=0
        )
    ]
    assert first.end_line == 4
    assert second.heredocs == [
        DockerfileHeredoc(
            name="EOT", content="\thi\n", chomp=True, expand=False, file_descriptor=0
        )
    ]


def test_strips_a_bom():
    ast = parse_dockerfile_ast("\ufeffFROM a\n")
    assert ast.instructions[0].name == "FROM"


def test_warns_about_empty_continuation_lines():
    ast = parse_dockerfile_ast("FROM a\nRUN a \\\n\nb\n")
    assert ast.instructions[1].args == ["a b"]
    assert len(ast.warnings) == 1
    assert "Empty continuation line" in ast.warnings[0].message


def test_tolerates_a_trailing_continuation_at_eof():
    ast = parse_dockerfile_ast("FROM a\nRUN echo \\\n")
    assert ast.instructions[1].args == ["echo"]


def test_accepts_empty_and_comment_only_input():
    assert parse_dockerfile_ast("").instructions == []
    assert parse_dockerfile_ast("# only comment\n").instructions == []


def test_rejects_unknown_instructions_with_a_line_number():
    with pytest.raises(DockerfileSyntaxError, match="line 2: unknown instruction: RNU"):
        parse_dockerfile_ast("FROM a\nRNU x\n")


def test_parse_heredoc():
    assert parse_heredoc("<<" + " " * 50_000 + "<") is None
    assert parse_heredoc("<<" + " " * 50_000) is None
    assert parse_heredoc("<<-EOF") == DockerfileHeredoc(
        name="EOF", content="", chomp=True, expand=True, file_descriptor=0
    )
    assert parse_heredoc("<<'EOF'") == DockerfileHeredoc(
        name="EOF", content="", chomp=False, expand=False, file_descriptor=0
    )
    heredoc = parse_heredoc("3<<EOF")
    assert heredoc is not None and heredoc.file_descriptor == 3
    assert parse_heredoc("<<") is None
    assert parse_heredoc("abc") is None


def test_chomp_heredoc_content_strips_leading_tabs():
    assert chomp_heredoc_content("\thi\n\t\tthere\n") == "hi\nthere\n"


def test_parse_words_keeps_quotes_and_escapes():
    assert parse_words('a "b c" d\\ e', "\\") == ["a", '"b c"', "d\\ e"]
