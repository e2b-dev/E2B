import threading

import pytest

from e2b import TimeoutException
from e2b_code_interpreter import Sandbox


@pytest.mark.skip_debug
def test_run_code_raises_when_sandbox_is_killed_during_execution(sandbox: Sandbox):
    timer = threading.Timer(2.0, sandbox.kill)
    timer.start()

    try:
        with pytest.raises(
            TimeoutException,
            match="sandbox was killed while the request was in progress",
        ):
            # Keep the execution firmly in-flight until the kill: the sleep is
            # far longer than the kill delay and the execution timeout is well
            # beyond the kill + disconnect-detection window, so the only thing
            # that ends the request is the sandbox being killed.
            sandbox.run_code("import time; time.sleep(300)", timeout=300)
    finally:
        timer.cancel()
