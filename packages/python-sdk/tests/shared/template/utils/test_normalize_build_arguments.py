import pytest

from e2b.template.utils import normalize_build_arguments
from e2b.exceptions import TemplateException


def test_handles_string_name():
    result = normalize_build_arguments(name="my-template:v1.0")
    assert result == "my-template:v1.0"


def test_handles_name_without_tag():
    result = normalize_build_arguments(name="my-template")
    assert result == "my-template"


def test_handles_legacy_alias():
    result = normalize_build_arguments(alias="my-template")
    assert result == "my-template"


def test_name_takes_precedence_over_alias():
    # When both are provided, name should be used
    result = normalize_build_arguments(name="from-name", alias="from-alias")
    assert result == "from-name"


def test_throws_for_empty_name():
    with pytest.raises(TemplateException, match="Name must be provided"):
        normalize_build_arguments(name="")


def test_throws_for_empty_alias():
    with pytest.raises(TemplateException, match="Name must be provided"):
        normalize_build_arguments(alias="")


def test_throws_for_missing_name_and_alias():
    with pytest.raises(TemplateException, match="Name must be provided"):
        normalize_build_arguments()


def test_throws_for_none_values():
    with pytest.raises(TemplateException, match="Name must be provided"):
        normalize_build_arguments(name=None, alias=None)
