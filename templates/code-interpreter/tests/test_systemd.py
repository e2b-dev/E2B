import time

import httpx
import pytest
from e2b import Sandbox

from conftest import make_client
from harness import CodeInterpreter

pytestmark = pytest.mark.skip_debug


def wait_for_health(client: CodeInterpreter, max_retries=10, interval_ms=100) -> bool:
    for _ in range(max_retries):
        try:
            if client.health(timeout=5).status_code == 200:
                return True
        except httpx.HTTPError:
            pass
        time.sleep(interval_ms / 1000)
    return False


def kill_process(sandbox: Sandbox, pattern: str) -> None:
    # The command handle may get killed too (killing jupyter cascades to the
    # code-interpreter service), so errors are ignored.
    try:
        sandbox.commands.run(f"kill -9 $(pgrep -f '{pattern}')", user="root")
    except Exception:
        pass


@pytest.mark.parametrize("pattern", ["jupyter server", "uvicorn main:app"])
def test_restart_after_kill(sandbox: Sandbox, pattern: str):
    client = make_client(sandbox)
    assert wait_for_health(client)

    kill_process(sandbox, pattern)

    # Wait for systemd to restart the service(s) and health to come back
    assert wait_for_health(client, 60, 500)

    execution = client.run_code("x = 1; x")
    assert execution.text == "1"
    client.close()
