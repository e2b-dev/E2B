import threading
import time

import httpx
import pytest
from e2b import Sandbox

from conftest import make_client
from harness import Execution


@pytest.mark.skip_debug
def test_execution_ends_when_sandbox_is_killed(sandbox: Sandbox):
    client = make_client(sandbox)
    kill_error: list[BaseException] = []

    def kill():
        try:
            sandbox.kill()
        except BaseException as error:  # surfaced below, Timer swallows it
            kill_error.append(error)

    timer = threading.Timer(2.0, kill)
    timer.start()

    execution = Execution()
    started = time.monotonic()
    try:
        # The sleep is far longer than the kill delay, so the only thing that
        # can end the request is the sandbox being killed; the client timeout
        # just keeps a failed kill from hanging the test.
        with pytest.raises(httpx.HTTPError):
            for event in client.stream_code("import time; time.sleep(300)", timeout=60):
                execution.add(event)
    finally:
        timer.join()
        client.close()

    assert not kill_error, kill_error
    assert time.monotonic() - started < 60
    assert not execution.completed
    assert not sandbox.is_running()
