import json
from pathlib import Path
from typing import List, Optional, TypedDict

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
