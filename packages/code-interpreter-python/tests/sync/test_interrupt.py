import time

import pytest

from e2b import TimeoutException
from e2b_code_interpreter.code_interpreter_sync import Sandbox


def test_subsequent_execution_works_after_client_timeout(sandbox: Sandbox):
    # Start a long-running execution with a short timeout.
    # This simulates a client disconnect: the SDK closes the connection,
    # which should trigger the server to interrupt the kernel (#213).
    with pytest.raises(TimeoutException):
        sandbox.run_code("import time; time.sleep(300)", timeout=3)

    # Wait for the server to detect the disconnect (via keepalive write
    # failure) and interrupt the kernel.
    time.sleep(5)

    # Run a simple execution. Without the kernel interrupt fix, this would
    # block behind the still-running sleep(300) and time out. The budget has
    # to cover how long the server takes to notice the disconnect through the
    # sandbox proxies (tens of seconds in CI); it used to be hidden by the
    # transport doubling every timeout.
    result = sandbox.run_code("1 + 1", timeout=90)
    assert result.text == "2"
