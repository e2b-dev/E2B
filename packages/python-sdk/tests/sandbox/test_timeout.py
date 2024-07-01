from time import sleep

import pytest

from e2b import NotFoundException


@pytest.mark.skip_debug()
def test_shorten_timeout(sandbox):
    sandbox.set_timeout(5)
    sleep(6)
    with pytest.raises(NotFoundException):
        sandbox.is_running()


@pytest.mark.skip_debug()
def test_shorten_then_lengthen_timeout(sandbox):
    sandbox.set_timeout(5)
    sleep(1)
    sandbox.set_timeout(10)
    sleep(6)
    sandbox.is_running()
