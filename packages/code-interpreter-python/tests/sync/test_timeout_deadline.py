import time

import pytest

from e2b import TimeoutException
from e2b_code_interpreter.code_interpreter_sync import Sandbox

TIMEOUT = 10
# The timeout must fire at TIMEOUT, not at twice it.
MAX_ELAPSED = TIMEOUT + 4


def test_run_code_times_out_at_timeout(sandbox: Sandbox):
    start = time.monotonic()
    with pytest.raises(TimeoutException):
        sandbox.run_code("import time; time.sleep(30)", timeout=TIMEOUT)
    assert time.monotonic() - start < MAX_ELAPSED


def test_run_code_longer_than_timeout_raises(sandbox: Sandbox):
    # Finishes between TIMEOUT and 2 * TIMEOUT: with a doubled deadline it
    # would return normally.
    with pytest.raises(TimeoutException):
        sandbox.run_code("import time; time.sleep(13); print('done')", timeout=TIMEOUT)
