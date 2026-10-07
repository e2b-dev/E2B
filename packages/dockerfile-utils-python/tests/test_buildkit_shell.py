import json
from pathlib import Path
from typing import Dict, List, Optional, TypedDict

import pytest

from e2b_dockerfile_utils import ShellLex

# BuildKit's `frontend/dockerfile/shell` word tables, see
# `fixtures/buildkit/README.md` for how the expectations were generated.

FIXTURES = Path(__file__).parent / "fixtures" / "buildkit" / "shell"


class LexCase(TypedDict, total=False):
    input: str
    word: Optional[str]
    words: List[str]
    error: bool


class EnvCase(TypedDict, total=False):
    input: str
    env: Dict[str, str]
    word: str
    words: List[str]
    error: bool


def load_cases(name: str) -> List[LexCase]:
    return json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))


def check(case: LexCase, raw_quotes: bool) -> None:
    lex = ShellLex("\\", raw_quotes=raw_quotes)
    if case.get("error"):
        with pytest.raises(ValueError):
            lex.process_word(case["input"])
        with pytest.raises(ValueError):
            lex.process_words(case["input"])
        return
    assert lex.process_word(case["input"]) == case["word"]
    assert lex.process_words(case["input"]) == case["words"]


@pytest.mark.parametrize("case", load_cases("wordsTest"), ids=lambda c: c["input"])
def test_words(case: LexCase):
    check(case, raw_quotes=False)


@pytest.mark.parametrize(
    "case", load_cases("wordsTest.rawQuotes"), ids=lambda c: c["input"]
)
def test_words_raw_quotes(case: LexCase):
    check(case, raw_quotes=True)


@pytest.mark.parametrize("case", load_cases("envVarTest"), ids=lambda c: c["input"])
def test_env_var(case: LexCase):
    check(case, raw_quotes=False)


_ENV = {"PWD": "/home", "SHELL": "bash", "KOREAN": "한국어", "NULL": ""}


@pytest.mark.parametrize("case", load_cases("envVarTest.env"), ids=lambda c: c["input"])
def test_env_var_expanded(case: LexCase):
    lex = ShellLex("\\", env=_ENV, skip_unset_env=False)
    if case.get("error"):
        with pytest.raises(ValueError):
            lex.process_word(case["input"])
        return
    assert lex.process_word(case["input"]) == case["word"]


# TestShellParser4Words with the `ENV` lines of `wordsTest` applied
# cumulatively. Upstream also loops a RawQuotes + SkipUnsetEnv mode, but it
# re-scans the already exhausted file, so only the normal mode is asserted.
@pytest.mark.parametrize("case", load_cases("wordsTest.env"), ids=lambda c: c["input"])
def test_words_with_env(case: EnvCase):
    lex = ShellLex("\\", env=case["env"], skip_unset_env=False)
    if case.get("error"):
        with pytest.raises(ValueError):
            lex.process_words(case["input"])
        return
    assert lex.process_words(case["input"]) == case["words"]


@pytest.mark.parametrize(
    "case", load_cases("processWithMatches"), ids=lambda c: c["input"]
)
def test_process_with_matches(case: EnvCase):
    lex = ShellLex("\\", env=case["env"], skip_unset_env=False)
    if case.get("error"):
        with pytest.raises(ValueError):
            lex.process_word(case["input"])
        return
    assert lex.process_word(case["input"]) == case["word"]


def _expand(word: str, env: Dict[str, str]) -> str:
    return ShellLex("\\", env=env, skip_unset_env=False).process_word(word)


def test_process_with_matches_platform():
    release = (
        "something-${VERSION}.${TARGETOS}-${TARGETARCH}"
        "${TARGETVARIANT:+-${TARGETVARIANT}}.tar.gz"
    )
    base = {"VERSION": "v1.2.3", "TARGETOS": "linux"}
    assert (
        _expand(release, {**base, "TARGETARCH": "arm", "TARGETVARIANT": "v7"})
        == "something-v1.2.3.linux-arm-v7.tar.gz"
    )
    assert (
        _expand(release, {**base, "TARGETARCH": "arm64", "TARGETVARIANT": ""})
        == "something-v1.2.3.linux-arm64.tar.gz"
    )
    assert (
        _expand(release, {**base, "TARGETARCH": "arm64"})
        == "something-v1.2.3.linux-arm64.tar.gz"
    )


def test_shell_parser_mandatory_env_vars():
    set_ = {"VAR": "plain", "ARG": "x"}
    empty = {"VAR": "", "ARG": "x"}
    unset = {"ARG": "x"}
    no_empty = "${VAR:?message here$ARG}"
    no_unset = "${VAR?message here$ARG}"

    assert _expand(no_empty, set_) == "plain"
    with pytest.raises(ValueError, match="message herex"):
        _expand(no_empty, empty)
    with pytest.raises(ValueError, match="message herex"):
        _expand(no_empty, unset)

    assert _expand(no_unset, set_) == "plain"
    assert _expand(no_unset, empty) == ""
    with pytest.raises(ValueError, match="message herex"):
        _expand(no_unset, unset)
