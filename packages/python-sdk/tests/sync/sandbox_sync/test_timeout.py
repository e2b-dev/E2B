from time import sleep
from datetime import datetime

import pytest


@pytest.mark.skip_debug()
def test_shorten_timeout(sandbox):
    sandbox.set_timeout(5)
    sleep(6)

    is_running = sandbox.is_running(request_timeout=5)
    assert is_running is False


@pytest.mark.skip_debug()
def test_shorten_then_lengthen_timeout(sandbox):
    sandbox.set_timeout(5)
    sleep(1)
    sandbox.set_timeout(10)
    sleep(6)
    sandbox.is_running()


@pytest.mark.skip_debug()
def test_get_timeout(sandbox):
    info = sandbox.get_info()
    assert isinstance(info.end_at, datetime)
