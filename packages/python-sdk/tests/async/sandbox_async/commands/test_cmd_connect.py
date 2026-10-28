import pytest

from e2b import NotFoundException, AsyncSandbox


async def test_connect_to_process(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("sleep 10", background=True)
    pid = cmd.pid

    process_info = await async_sandbox.commands.connect(pid)
    assert process_info.pid == pid


async def test_connect_to_non_existing_process(async_sandbox: AsyncSandbox):
    non_existing_pid = 999999

    with pytest.raises(NotFoundException):
        await async_sandbox.commands.connect(non_existing_pid)


async def test_connect_without_retaining_output(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("sleep 1; echo out", background=True)

    stdout = []
    handle = await async_sandbox.commands.connect(
        cmd.pid, on_stdout=stdout.append, retain_output=False
    )
    result = await handle.wait()

    assert result.stdout is None
    assert "".join(stdout) == "out\n"
