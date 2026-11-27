import math

from typing import Any, Callable, Dict

import pytest

from e2b import InvalidArgumentException, NotFoundException, PtySize
from sdk_flavours import Sdk, result

# Arguments envd would act on as something else, or that never reach it as they
# were given. Each is refused before a request is sent, which the tests read off
# `backend`, a local server in place of the API and envd. `any_sandbox` is a
# sandbox of either SDK flavour that exists only in that server's answers.

NAN = float("nan")
SIZE = PtySize(rows=24, cols=80)


def _on_data(data: Any) -> None:
    return None


def _create_pty(sdk: Sdk, sandbox: Any, size: PtySize, **kwargs: Any) -> Any:
    # The async flavour takes the output handler as an argument.
    if sdk.is_async:
        return sandbox.pty.create(size, _on_data, **kwargs)
    return sandbox.pty.create(size, **kwargs)


# --- paths


@pytest.mark.parametrize("path", ["", None])
async def test_remove_refuses_a_path_that_names_nothing(any_sandbox, backend, path):
    with pytest.raises(InvalidArgumentException, match="path"):
        await result(any_sandbox.files.remove(path))

    assert backend.sent == []


@pytest.mark.parametrize(("old_path", "new_path"), [("", "new"), ("old", "")])
async def test_rename_refuses_an_empty_source_or_destination(
    any_sandbox, backend, old_path, new_path
):
    with pytest.raises(InvalidArgumentException, match="_path"):
        await result(any_sandbox.files.rename(old_path, new_path))

    assert backend.sent == []


# --- signed URLs


@pytest.mark.parametrize("method", ["download_url", "upload_url"])
@pytest.mark.parametrize("expiration", ["60", 1.5, True])
def test_signature_expiration_must_be_whole_seconds(any_sandbox, method, expiration):
    with pytest.raises(InvalidArgumentException, match="use_signature_expiration"):
        getattr(any_sandbox, method)("file.txt", use_signature_expiration=expiration)


# --- timeouts


@pytest.mark.parametrize("timeout", [-5, NAN, "60"])
async def test_command_timeout_must_be_a_duration(any_sandbox, backend, timeout):
    with pytest.raises(InvalidArgumentException, match="timeout"):
        await result(any_sandbox.commands.run("echo", timeout=timeout))

    assert backend.sent == []


@pytest.mark.parametrize("timeout", [-5, NAN, "60"])
async def test_pty_timeout_must_be_a_duration(sdk, any_sandbox, backend, timeout):
    with pytest.raises(InvalidArgumentException, match="timeout"):
        await result(_create_pty(sdk, any_sandbox, SIZE, timeout=timeout))

    assert backend.sent == []


@pytest.mark.parametrize("request_timeout", [-1, NAN, "60"])
async def test_request_timeout_of_a_command_call_must_be_a_duration(
    any_sandbox, backend, request_timeout
):
    with pytest.raises(InvalidArgumentException, match="request_timeout"):
        await result(any_sandbox.commands.kill(1, request_timeout=request_timeout))

    assert backend.sent == []


@pytest.mark.parametrize("request_timeout", [-1, NAN, "60"])
async def test_request_timeout_of_a_file_call_must_be_a_duration(
    any_sandbox, backend, request_timeout
):
    with pytest.raises(InvalidArgumentException, match="request_timeout"):
        await result(any_sandbox.files.list("/", request_timeout=request_timeout))

    assert backend.sent == []


@pytest.mark.parametrize("request_timeout", [-1, NAN, "60"])
async def test_request_timeout_of_a_new_sandbox_must_be_a_duration(
    sdk, backend, opts, request_timeout
):
    with pytest.raises(InvalidArgumentException, match="request_timeout"):
        await result(sdk.Sandbox.create(request_timeout=request_timeout, **opts))

    assert backend.sent == []


# envd is given a deadline as the `Connect-Timeout-Ms` header.
@pytest.mark.parametrize(
    ("timeout", "deadline"),
    [(math.inf, None), (0, None), (1.5, "1500")],
    ids=["infinity", "zero", "seconds"],
)
async def test_command_timeout_is_sent_as_the_deadline(
    any_sandbox, backend, timeout, deadline
):
    with pytest.raises(NotFoundException, match="answered by the test"):
        await result(any_sandbox.commands.run("echo", timeout=timeout))

    assert backend.requests[0].headers.get("connect-timeout-ms") == deadline


@pytest.mark.parametrize(
    ("request_timeout", "deadline"),
    [(math.inf, None), (0, None), (2, "2000")],
    ids=["infinity", "zero", "seconds"],
)
async def test_request_timeout_is_sent_as_the_deadline(
    any_sandbox, backend, request_timeout, deadline
):
    await result(any_sandbox.commands.kill(1, request_timeout=request_timeout))

    assert backend.requests[0].headers.get("connect-timeout-ms") == deadline


# --- numbers envd holds in a fixed width

PID_CALLS: Dict[str, Callable[[Any, Any], Any]] = {
    "commands.kill": lambda sbx, pid: sbx.commands.kill(pid),
    "commands.send_stdin": lambda sbx, pid: sbx.commands.send_stdin(pid, "data"),
    "commands.close_stdin": lambda sbx, pid: sbx.commands.close_stdin(pid),
    "commands.connect": lambda sbx, pid: sbx.commands.connect(pid),
    "pty.kill": lambda sbx, pid: sbx.pty.kill(pid),
    "pty.send_stdin": lambda sbx, pid: sbx.pty.send_stdin(pid, b"data"),
    "pty.resize": lambda sbx, pid: sbx.pty.resize(pid, SIZE),
}


@pytest.mark.parametrize("pid", [-1, 1.5, "1", True, 2**32, None])
@pytest.mark.parametrize("call", PID_CALLS.values(), ids=PID_CALLS.keys())
async def test_pid_must_fit_what_envd_takes(any_sandbox, backend, call, pid):
    with pytest.raises(InvalidArgumentException, match="pid"):
        await result(call(any_sandbox, pid))

    assert backend.sent == []


@pytest.mark.parametrize("pid", [-1, "1"])
async def test_stream_input_refuses_a_pid_envd_cannot_take(
    sdk, any_sandbox, backend, pid
):
    # The sync flavour takes the chunks here, the async one returns a handle.
    args = () if sdk.is_async else (["data"],)

    with pytest.raises(InvalidArgumentException, match="pid"):
        any_sandbox.commands.stream_input(pid, *args)

    assert backend.sent == []


SIDES = [0, -1, 80.5, 65536, "80", None]


@pytest.mark.parametrize("side", SIDES)
@pytest.mark.parametrize("field", ["cols", "rows"])
async def test_pty_create_refuses_a_size_envd_cannot_hold(
    sdk, any_sandbox, backend, field, side
):
    size = PtySize(**{"rows": 24, "cols": 80, field: side})

    with pytest.raises(InvalidArgumentException, match=field):
        await result(_create_pty(sdk, any_sandbox, size))

    assert backend.sent == []


@pytest.mark.parametrize("side", SIDES)
@pytest.mark.parametrize("field", ["cols", "rows"])
async def test_pty_resize_refuses_a_size_envd_cannot_hold(
    any_sandbox, backend, field, side
):
    size = PtySize(**{"rows": 24, "cols": 80, field: side})

    with pytest.raises(InvalidArgumentException, match=field):
        await result(any_sandbox.pty.resize(1, size))

    assert backend.sent == []
