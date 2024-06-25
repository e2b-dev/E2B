import os
import pytest

from e2b import Sandbox


@pytest.mark.skipif(os.getenv("E2B_DEBUG") is not None)
def test_kill_existing_sandbox(sandbox: Sandbox):
    Sandbox.kill(sandbox.sandbox_id)


def test_kill_non_existing_sandbox():
    with pytest.raises(RuntimeError):
        Sandbox.kill("non-existing-sandbox")
