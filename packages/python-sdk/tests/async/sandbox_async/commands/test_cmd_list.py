from e2b import AsyncSandbox


async def test_kill_process(async_sandbox: AsyncSandbox):
    c1 = await async_sandbox.commands.run("sleep 10", background=True)
    c2 = await async_sandbox.commands.run("sleep 10", background=True)

    processes = await async_sandbox.commands.list()

    assert len(processes) >= 2
    pids = [p.pid for p in processes]
    assert c1.pid in pids
    assert c2.pid in pids
