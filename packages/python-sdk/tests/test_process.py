from os import getenv
from unittest.mock import MagicMock

from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")


async def test_process_on_stdout_stderr():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY)

    stdout = []
    stderr = []

    proc = await session.process.start(
        "pwd",
        on_stdout=lambda data: stdout.append(data),
        on_stderr=lambda data: stderr.append(data),
        rootdir="/tmp",
    )

    output = await proc

    assert output.error == False
    assert output.stdout == "/tmp"
    assert output.stderr == ""
    assert list(map(lambda message: message.line, stdout)) == ["/tmp"]
    assert stderr == []

    await session.close()


async def test_process_on_exit():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY)

    on_exit = MagicMock()

    proc = await session.process.start(
        "pwd",
        on_exit=lambda: on_exit(),
    )

    await proc
    on_exit.assert_called_once()

    await session.close()


async def test_process_send_stdin():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY)

    proc = await session.process.start(
        'while IFS= read -r line; do echo "$line"; sleep 1; done',
        rootdir="/code",
    )
    await proc.send_stdin("ping\n")
    await proc.kill()

    assert proc.output.stdout == "ping"

    assert len(proc.output_messages) == 1
    message = proc.output_messages[0]
    assert message.line == "ping"
    assert message.error == False

    await session.close()
