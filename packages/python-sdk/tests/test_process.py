from unittest.mock import MagicMock

from e2b import Session


def test_process_expected_stdout():
    # TODO: Implement this once we fix envd stdout/stderr race condition
    pass


def test_process_expected_stderr():
    # TODO: Implement this once we fix envd stdout/stderr race condition
    pass


def test_process_on_stdout_stderr():
    session = Session("Nodejs")

    stdout = []
    stderr = []

    proc = session.process.start(
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

    session.close()


def test_process_on_exit():
    session = Session("Nodejs")

    on_exit = MagicMock()

    proc = session.process.start(
        "pwd",
        on_exit=lambda: on_exit(),
    )

    proc.wait()
    on_exit.assert_called_once()

    session.close()


def test_process_send_stdin():
    session = Session("Nodejs")

    proc = session.process.start(
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

    session.close()


def test_default_on_exit():
    on_exit = MagicMock()

    session = Session("Nodejs", on_exit=lambda: on_exit())
    proc = session.process.start(
        "pwd",
        on_exit=lambda: print("EXIT"),
    )
    proc.wait()
    on_exit.assert_not_called()

    proc = session.process.start(
        "pwd",
    )
    proc.wait()
    on_exit.assert_called_once()

    session.close()


def test_process_default_on_stdout_stderr():
    on_stdout = MagicMock()
    on_stderr = MagicMock()

    session = Session(
        "Nodejs",
        on_stdout=lambda data: on_stdout(),
        on_stderr=lambda data: on_stderr(),
    )
    code = "node -e \"console.log('hello'); throw new Error('error')\""

    stdout = []
    stderr = []

    proc = session.process.start(
        code,
        on_stdout=lambda data: stdout.append(data),
        on_stderr=lambda data: stderr.append(data),
    )

    proc.wait()
    on_stdout.assert_not_called()
    on_stderr.assert_not_called()

    proc = session.process.start(code)
    proc.wait()

    on_stdout.assert_called_once()
    on_stderr.assert_called()
    assert proc.exit_code == 1

    session.close()
