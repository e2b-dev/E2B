from unittest.mock import MagicMock

from e2b import Sandbox


def test_process_expected_stdout():
    # TODO: Implement this once we fix envd stdout/stderr race condition
    pass


def test_process_expected_stderr():
    # TODO: Implement this once we fix envd stdout/stderr race condition
    pass


def test_process_on_stdout_stderr():
    sandbox = Sandbox()

    stdout = []
    stderr = []

    proc = sandbox.process.start(
        "pwd",
        on_stdout=lambda data: stdout.append(data),
        on_stderr=lambda data: stderr.append(data),
        cwd="/tmp",
    )

    output = proc.wait()

    assert not output.error
    assert output.stdout == "/tmp"
    assert output.stderr == ""
    assert list(map(lambda message: message.line, stdout)) == ["/tmp"]
    assert stderr == []
    assert proc.exit_code == 0

    sandbox.close()


def test_process_on_exit():
    sandbox = Sandbox()

    on_exit = MagicMock()

    proc = sandbox.process.start(
        "pwd",
        on_exit=lambda exit_code: on_exit(exit_code),
    )

    proc.wait()
    on_exit.assert_called_once()

    sandbox.close()


def test_process_send_stdin():
    sandbox = Sandbox()

    proc = sandbox.process.start(
        'read -r line; echo "$line"',
        cwd="/code",
    )
    proc.send_stdin("ping\n")
    proc.wait()

    assert proc.output.stdout == "ping"

    assert len(proc.output_messages) == 1
    message = proc.output_messages[0]
    assert message.line == "ping"
    assert not message.error

    sandbox.close()


def test_default_on_exit():
    on_exit = MagicMock()

    sandbox = Sandbox(on_exit=lambda exit_code: on_exit(exit_code))
    proc = sandbox.process.start(
        "pwd",
        on_exit=lambda: print("EXIT"),
    )
    proc.wait()
    on_exit.assert_not_called()

    proc = sandbox.process.start(
        "pwd",
    )
    proc.wait()
    on_exit.assert_called_once()

    sandbox.close()


def test_process_default_on_stdout_stderr():
    on_stdout = MagicMock()
    on_stderr = MagicMock()

    sandbox = Sandbox(
        on_stdout=lambda data: on_stdout(),
        on_stderr=lambda data: on_stderr(),
    )
    code = "node -e \"console.log('hello'); throw new Error('error')\""

    stdout = []
    stderr = []

    proc = sandbox.process.start(
        code,
        on_stdout=lambda data: stdout.append(data),
        on_stderr=lambda data: stderr.append(data),
    )

    proc.wait()
    on_stdout.assert_not_called()
    on_stderr.assert_not_called()

    proc = sandbox.process.start(code)
    proc.wait()

    on_stdout.assert_called_once()
    on_stderr.assert_called()
    assert proc.exit_code == 1

    sandbox.close()


def test_process_start_and_wait():
    sandbox = Sandbox()
    code = "node -e \"console.log('hello');\""

    output = sandbox.process.start_and_wait(code)

    proc = sandbox.process.start(code)
    proc.wait()

    assert output.exit_code == 0

    sandbox.close()
