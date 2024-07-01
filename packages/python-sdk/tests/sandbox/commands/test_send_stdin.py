def test_send_stdin_to_process(sandbox):
    cmd = sandbox.commands.run("cat", background=True)
    sandbox.commands.send_stdin(cmd.pid, "Hello, World!")
    cmd.kill()
    assert cmd.stdout == "Hello, World!"


def test_send_empty_stdin_to_process(sandbox):
    cmd = sandbox.commands.run("cat", background=True)
    sandbox.commands.send_stdin(cmd.pid, "")
    cmd.kill()
    assert cmd.stdout == ""


def test_send_special_characters_to_process(sandbox):
    cmd = sandbox.commands.run("cat", background=True)
    sandbox.commands.send_stdin(cmd.pid, "!@#$%^&*()_+")
    cmd.kill()
    assert cmd.stdout == "!@#$%^&*()_+"


def test_send_multiline_string_to_process(sandbox):
    cmd = sandbox.commands.run("cat", background=True)
    sandbox.commands.send_stdin(cmd.pid, "Hello,\nWorld!")
    cmd.kill()
    assert cmd.stdout == "Hello,\nWorld!"
