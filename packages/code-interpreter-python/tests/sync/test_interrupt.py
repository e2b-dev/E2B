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
    # block behind the still-running sleep(30) and time out.
    result = sandbox.run_code("1 + 1", timeout=10)
    assert result.text == "2"
