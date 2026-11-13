import pytest

from e2b import NotFoundException


def test_connect_to_process(sandbox):
    cmd = sandbox.commands.run("sleep 10", background=True)
    pid = cmd.pid

    process_info = sandbox.commands.connect(pid)
    assert process_info.pid == pid


def test_connect_to_non_existing_process(sandbox):
    non_existing_pid = 999999

    with pytest.raises(NotFoundException):
        sandbox.commands.connect(non_existing_pid)


def test_connect_without_retaining_output(sandbox):
    cmd = sandbox.commands.run("sleep 1; echo out", background=True)

    stdout = []
    handle = sandbox.commands.connect(cmd.pid, retain_output=False)
    result = handle.wait(on_stdout=stdout.append)

    assert result.stdout is None
    assert "".join(stdout) == "out\n"
