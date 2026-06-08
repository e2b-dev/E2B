from e2b import Sandbox


def test_send_stdin_to_process(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)
    sandbox.commands.send_stdin(cmd.pid, "Hello, World!")

    for stdout, _, _ in cmd:
        assert stdout == "Hello, World!"
        break


def test_send_stdin_via_command_handle(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)
    cmd.send_stdin("Hello, World!")

    for stdout, _, _ in cmd:
        assert stdout == "Hello, World!"
        break


def test_close_stdin_via_command_handle(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)
    cmd.send_stdin("Hello, World!")
    cmd.close_stdin()

    # `cat` exits once stdin is closed (EOF).
    result = cmd.wait()
    assert result.exit_code == 0
    assert result.stdout == "Hello, World!"


def test_send_special_characters_to_process(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)
    sandbox.commands.send_stdin(cmd.pid, "!@#$%^&*()_+")

    for stdout, _, _ in cmd:
        assert stdout == "!@#$%^&*()_+"
        break


def test_send_multiline_string_to_process(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)
    sandbox.commands.send_stdin(cmd.pid, "Hello,\nWorld!")

    for stdout, _, _ in cmd:
        assert stdout == "Hello,\nWorld!"
        break
