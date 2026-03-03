import os

import pytest

_DIR = os.path.dirname(os.path.abspath(__file__))


def pytest_collection_modifyitems(items):
    for item in items:
        if str(item.fspath).startswith(_DIR):
            item.add_marker(pytest.mark.timeout(180))
