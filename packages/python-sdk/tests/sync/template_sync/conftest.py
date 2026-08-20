import os

import pytest

from mock_build_api import MockBuildAPI

_DIR = os.path.dirname(os.path.abspath(__file__))


@pytest.fixture(autouse=True)
def mock_build_api(monkeypatch, test_api_key) -> MockBuildAPI:
    """Route all template build API calls through the in-memory mock."""
    monkeypatch.setenv("E2B_API_KEY", test_api_key)
    mock = MockBuildAPI()
    mock.install_sync(monkeypatch)
    return mock


def pytest_collection_modifyitems(items):
    for item in items:
        if str(item.fspath).startswith(_DIR):
            item.add_marker(pytest.mark.timeout(180))
