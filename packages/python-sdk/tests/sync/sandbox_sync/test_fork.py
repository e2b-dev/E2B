import pytest

from e2b import Sandbox
from e2b.exceptions import InvalidArgumentException, SandboxNotFoundException


@pytest.mark.skip_debug()
def test_fork(sandbox: Sandbox):
    sandbox.files.write("/home/user/state.txt", "state before fork")

    forks = sandbox.fork()
    assert len(forks) == 1

    fork = forks[0]
    assert isinstance(fork, Sandbox)

    try:
        assert fork.sandbox_id != sandbox.sandbox_id

        # The original sandbox keeps running
        assert sandbox.is_running()
        assert fork.is_running()

        # The fork inherits the filesystem state
        assert fork.files.read("/home/user/state.txt") == "state before fork"

        # The fork is independent of the original
        fork.files.write("/home/user/state.txt", "modified in fork")
        assert sandbox.files.read("/home/user/state.txt") == "state before fork"
    finally:
        fork.kill()


@pytest.mark.skip_debug()
def test_fork_multiple(sandbox: Sandbox):
    forks = sandbox.fork(count=2, timeout=60)
    assert len(forks) == 2

    forked_sandboxes = [fork for fork in forks if isinstance(fork, Sandbox)]

    try:
        assert len(forked_sandboxes) == 2

        ids = {s.sandbox_id for s in forked_sandboxes}
        assert len(ids) == 2
        assert sandbox.sandbox_id not in ids

        for fork in forked_sandboxes:
            assert fork.is_running()
    finally:
        for fork in forked_sandboxes:
            fork.kill()


@pytest.mark.skip_debug()
def test_fork_by_id(sandbox: Sandbox):
    forks = Sandbox.fork(sandbox.sandbox_id)
    assert len(forks) == 1

    fork = forks[0]
    assert isinstance(fork, Sandbox)

    try:
        assert fork.is_running()
    finally:
        fork.kill()


@pytest.mark.skip_debug()
def test_fork_killed_sandbox(sandbox_factory):
    sandbox = sandbox_factory()
    sandbox.kill()

    with pytest.raises(SandboxNotFoundException):
        sandbox.fork()


def test_fork_invalid_count():
    with pytest.raises(InvalidArgumentException):
        Sandbox.fork("sbx-test", count=0)
