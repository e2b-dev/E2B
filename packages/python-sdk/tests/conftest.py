import pytest

from logging import warning

from e2b import Sandbox


@pytest.fixture()
def template():
    return "base"


@pytest.fixture()
def sandbox(template):
    sandbox = Sandbox(template)

    try:
        yield sandbox
    finally:
        try:
            sandbox.kill()
        except:
            warning(
                "Failed to kill sandbox — this is expected if the test runs with local envd."
            )
