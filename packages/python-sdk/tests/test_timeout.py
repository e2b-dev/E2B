import pytest

from e2b import Sandbox
from e2b.sandbox.exception import TimeoutException


def test_create_sandbox_timeout():
    sandbox: Sandbox | None = None

    with pytest.raises(TimeoutException):
        sandbox = Sandbox(timeout=0.01)

    if sandbox:
        sandbox.close()


def test_process_timeout():
    sandbox: Sandbox | None = None

    with pytest.raises(TimeoutException):
        sandbox = Sandbox()
        sandbox.process.start(
            "sleep 1",
            timeout=0.01,
        )

    if sandbox:
        sandbox.close()


def test_filesystem_timeout():
    sandbox: Sandbox | None = None

    with pytest.raises(TimeoutException):
        sandbox = Sandbox()
        sandbox.filesystem.write(
            "test.txt",
            "Hello World",
            timeout=0.01,
        )

    if sandbox:
        sandbox.close()
