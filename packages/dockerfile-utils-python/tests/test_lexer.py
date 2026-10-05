import pytest

from e2b_docker_utils import ShellLex, is_space

lex = ShellLex("\\")


def test_splits_words_and_strips_quotes():
    assert lex.process_words('KEY="a  b" OTHER=c') == ["KEY=a  b", "OTHER=c"]
    assert lex.process_words('a "b c" d\\ e') == ["a", "b c", "d e"]


def test_preserves_variable_references():
    assert lex.process_words('"$HOME"/x') == ["$HOME/x"]
    assert lex.process_words("'$HOME'") == ["$HOME"]
    assert lex.process_words("${V//a/b}") == ["${V//a/b}"]
    assert lex.process_words("a\\$b") == ["a$b"]


def test_keeps_heredoc_markers_intact():
    assert lex.process_words("<<EOF cat") == ["<<EOF", "cat"]


def test_honours_the_escape_token():
    assert ShellLex("`").process_word('a`"b') == 'a"b'


def test_raw_modes_keep_quotes_and_escapes():
    assert ShellLex("\\", raw_quotes=True).process_word('"a b"') == '"a b"'
    assert ShellLex("\\", raw_escapes=True).process_word('a\\"b') == 'a\\"b'


def test_rejects_unterminated_quotes():
    with pytest.raises(ValueError, match="double-quote"):
        lex.process_word('"unterminated')
    with pytest.raises(ValueError, match="single-quote"):
        lex.process_word("x 'y")


def test_is_space():
    assert is_space(" ")
    assert is_space("\xa0")
    assert not is_space("a")
