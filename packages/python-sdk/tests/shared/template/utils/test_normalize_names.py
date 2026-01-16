import pytest

from e2b.template.utils import normalize_names


def test_handles_string_name():
    result = normalize_names("my-template:v1.0")
    assert result == ["my-template:v1.0"]


def test_handles_list_of_names():
    result = normalize_names(["my-template:v1.0", "my-template:latest"])
    assert result == ["my-template:v1.0", "my-template:latest"]


def test_handles_legacy_alias():
    result = normalize_names(names=None, alias="my-template")
    assert result == ["my-template"]


def test_throws_when_both_names_and_alias_provided():
    with pytest.raises(ValueError, match="Cannot provide both names and alias"):
        normalize_names(names="my-template", alias="other-template")


def test_throws_for_empty_names():
    with pytest.raises(ValueError, match="Either names or alias must be provided"):
        normalize_names(names=None, alias=None)
