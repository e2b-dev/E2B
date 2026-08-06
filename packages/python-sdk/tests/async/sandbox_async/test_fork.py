import pytest

from e2b import AsyncSandbox
from e2b.exceptions import InvalidArgumentException, SandboxNotFoundException


@pytest.mark.skip_debug()
async def test_fork(async_sandbox: AsyncSandbox):
    await async_sandbox.files.write("/home/user/state.txt", "state before fork")

    forks = await async_sandbox.fork()
    assert len(forks) == 1

    fork = forks[0]
    assert isinstance(fork, AsyncSandbox)

    try:
        assert fork.sandbox_id != async_sandbox.sandbox_id

        # The original sandbox keeps running
        assert await async_sandbox.is_running()
        assert await fork.is_running()

        # The fork inherits the filesystem state
        assert await fork.files.read("/home/user/state.txt") == "state before fork"

        # The fork is independent of the original
        await fork.files.write("/home/user/state.txt", "modified in fork")
        assert (
            await async_sandbox.files.read("/home/user/state.txt")
            == "state before fork"
        )
    finally:
        await fork.kill()


@pytest.mark.skip_debug()
async def test_fork_multiple(async_sandbox: AsyncSandbox):
    forks = await async_sandbox.fork(count=2, timeout=60)
    assert len(forks) == 2

    forked_sandboxes = [fork for fork in forks if isinstance(fork, AsyncSandbox)]

    try:
        assert len(forked_sandboxes) == 2

        ids = {s.sandbox_id for s in forked_sandboxes}
        assert len(ids) == 2
        assert async_sandbox.sandbox_id not in ids

        for fork in forked_sandboxes:
            assert await fork.is_running()
    finally:
        for fork in forked_sandboxes:
            await fork.kill()


@pytest.mark.skip_debug()
async def test_fork_by_id(async_sandbox: AsyncSandbox):
    forks = await AsyncSandbox.fork(async_sandbox.sandbox_id)
    assert len(forks) == 1

    fork = forks[0]
    assert isinstance(fork, AsyncSandbox)

    try:
        assert await fork.is_running()
    finally:
        await fork.kill()


@pytest.mark.skip_debug()
async def test_fork_killed_sandbox(async_sandbox_factory):
    sandbox = await async_sandbox_factory()
    await sandbox.kill()

    with pytest.raises(SandboxNotFoundException):
        await sandbox.fork()


async def test_fork_invalid_count():
    with pytest.raises(InvalidArgumentException):
        await AsyncSandbox.fork("sbx-test", count=0)
