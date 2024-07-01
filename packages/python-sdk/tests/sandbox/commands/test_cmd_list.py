def test_kill_process(sandbox):
    sandbox.commands.run("sleep 10", background=True)
    sandbox.commands.run("sleep 10", background=True)

    processes = sandbox.commands.list()

    assert len(processes) >= 2
    for process in processes:
        assert "pid" in process
