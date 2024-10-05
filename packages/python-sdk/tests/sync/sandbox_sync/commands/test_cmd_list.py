from e2b import Sandbox


def test_kill_process(sandbox: Sandbox):
    c1 = sandbox.commands.run("sleep 10", background=True)
    c2 = sandbox.commands.run("sleep 10", background=True)

    processes = sandbox.commands.list()

    assert len(processes) >= 2
    pids = [p.pid for p in processes]
    assert c1.pid in pids
    assert c2.pid in pids
