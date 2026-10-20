from typing import Any, cast

import pytest

from e2b import InvalidArgumentException, Sandbox
from e2b.sandbox.commands.command_handle import PtySize


def test_stream_input_to_pty(sandbox: Sandbox):
    terminal = sandbox.pty.create(PtySize(cols=80, rows=24))

    def input_chars():
        yield from "echo hello-stream\nexit\n"

    sandbox.pty.stream_input(terminal.pid, input_chars(), timeout=0)

    output = []
    terminal.wait(on_pty=lambda data: output.append(data.decode("utf-8")))
    assert any(line.strip() == "hello-stream" for line in "".join(output).splitlines())


def test_stream_input_rejects_single_chunk(sandbox: Sandbox):
    with pytest.raises(InvalidArgumentException, match=r"\[data\]"):
        sandbox.pty.stream_input(1, cast(Any, "ls\n"))
