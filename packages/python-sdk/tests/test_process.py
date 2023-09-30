from unittest.mock import MagicMock

from e2b import Session


async def test_process_expected_stdout():
    # TODO: Implement this once we fix envd stdout/stderr race condition
    pass


async def test_process_expected_stderr():
    # TODO: Implement this once we fix envd stdout/stderr race condition
    pass


async def test_process_on_stdout_stderr():
    session = await Session.create("Nodejs")

    stdout = []
    stderr = []

    proc = await session.process.start(
        "pwd",
        on_stdout=lambda data: stdout.append(data),
        on_stderr=lambda data: stderr.append(data),
        cwd="/tmp",
    )

    output = await proc

    assert not output.error
    assert output.stdout == "/tmp"
    assert output.stderr == ""
    assert list(map(lambda message: message.line, stdout)) == ["/tmp"]
    assert stderr == []

    await session.close()


async def test_process_on_exit():
    session = await Session.create("Nodejs")

    on_exit = MagicMock()

    proc = await session.process.start(
        "pwd",
        on_exit=lambda: on_exit(),
    )

    await proc
    on_exit.assert_called_once()

    await session.close()


async def test_process_send_stdin():
    session = await Session.create("Nodejs")

    proc = await session.process.start(
        'read -r line; echo "$line"',
        cwd="/code",
    )
    await proc.send_stdin("ping\n")
    await proc

    assert proc.output.stdout == "ping"

    assert len(proc.output_messages) == 1
    message = proc.output_messages[0]
    assert message.line == "ping"
    assert not message.error

    await session.close()


async def test_default_on_exit():
    on_exit = MagicMock()

    session = await Session.create("Nodejs", on_exit=lambda: on_exit())
    proc = await session.process.start(
        "pwd",
        on_exit=lambda: print("EXIT"),
    )
    await proc
    on_exit.assert_not_called()

    proc = await session.process.start(
        "pwd",
    )
    await proc
    on_exit.assert_called_once()

    await session.close()


async def test_process_default_on_stdout_stderr():
    on_stdout = MagicMock()
    on_stderr = MagicMock()

    session = await Session.create(
        "Nodejs",
        on_stdout=lambda data: on_stdout(),
        on_stderr=lambda data: on_stderr(),
    )
    code = "node -e \"console.log('hello'); throw new Error('error')\""

    stdout = []
    stderr = []

    proc = await session.process.start(
        code,
        on_stdout=lambda data: stdout.append(data),
        on_stderr=lambda data: stderr.append(data),
    )

    await proc
    on_stdout.assert_not_called()
    on_stderr.assert_not_called()

    proc = await session.process.start(code)
    await proc

    on_stdout.assert_called_once()
    on_stderr.assert_called()

    await session.close()
