import pytest

from e2b import Secret
from e2b.exceptions import InvalidArgumentException


def test_fill():
    assert Secret.fill("openai-api-key") == "${e2b.secrets.openai-api-key}"


@pytest.mark.parametrize("name", ["", "{name", "name}", "name\n", "name\x00"])
def test_fill_invalid_name_raises(name):
    with pytest.raises(InvalidArgumentException):
        Secret.fill(name)
