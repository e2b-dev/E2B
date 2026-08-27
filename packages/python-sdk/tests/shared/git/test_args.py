import pytest

from e2b.exceptions import InvalidArgumentException
from e2b.sandbox._git import (
    build_remote_add_args,
    build_remote_get_command,
    build_reset_args,
)


def test_build_reset_args_rejects_invalid_mode():
    with pytest.raises(InvalidArgumentException) as exc:
        build_reset_args("bogus", None, None)
    # Order must match the JS SDK exactly.
    assert "Reset mode must be one of soft, mixed, hard, merge, keep." in str(exc.value)


def test_build_reset_args_accepts_valid_mode():
    assert build_reset_args("hard", "HEAD", None) == ["reset", "--hard", "HEAD"]


def test_build_remote_add_args_requires_name_and_url():
    with pytest.raises(InvalidArgumentException):
        build_remote_add_args("", "https://example.com", False)
    with pytest.raises(InvalidArgumentException):
        build_remote_add_args("origin", "", False)


def test_build_remote_get_command_requires_name():
    with pytest.raises(InvalidArgumentException):
        build_remote_get_command("/repo", "")
