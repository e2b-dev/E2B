import pytest

from e2b.exceptions import InvalidArgumentException


def test_create_github_repo_requires_name(git_sandbox):
    with pytest.raises(InvalidArgumentException):
        git_sandbox.git.create_github_repo("")
