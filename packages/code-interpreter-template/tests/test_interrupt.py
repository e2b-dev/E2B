import time

import httpx
import pytest

from harness import CodeInterpreter


def test_subsequent_execution_works_after_client_timeout(client: CodeInterpreter):
    # Start a long-running execution with a short client timeout.
    # Closing the connection should trigger the server to interrupt the
    # kernel (#213) instead of leaving it busy.
    with pytest.raises(httpx.TimeoutException):
        client.run_code("import time; time.sleep(300)", timeout=3)

    # Give the server time to detect the disconnect and interrupt the kernel.
    time.sleep(5)

    execution = client.run_code("1 + 1", timeout=10)
    assert execution.text == "2"
