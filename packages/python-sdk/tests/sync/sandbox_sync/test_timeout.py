from time import sleep
from e2b.exceptions import TimeoutException

import pytest


@pytest.mark.skip_debug()
@pytest.mark.skip(reason="is_running takes too long if the sandbox was just killed")
def test_shorten_timeout(sandbox):
    sandbox.set_timeout(5)
    sleep(6)
    with pytest.raises(TimeoutException):
        sandbox.is_running(request_timeout=5)


@pytest.mark.skip_debug()
def test_shorten_then_lengthen_timeout(sandbox):
    sandbox.set_timeout(5)
    sleep(1)
    sandbox.set_timeout(10)
    sleep(6)
    sandbox.is_running()
