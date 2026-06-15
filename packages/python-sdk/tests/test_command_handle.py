from e2b.envd.process import process_pb2
from e2b.sandbox_async.commands.command_handle import AsyncCommandHandle
from e2b.sandbox_sync.commands.command_handle import CommandHandle

EMOJI = "😀"
EMOJI_BYTES = EMOJI.encode("utf-8")  # 4 bytes


def _stdout_event(data: bytes) -> process_pb2.StartResponse:
    return process_pb2.StartResponse(
        event=process_pb2.ProcessEvent(
            data=process_pb2.ProcessEvent.DataEvent(stdout=data)
        )
    )


def _stderr_event(data: bytes) -> process_pb2.StartResponse:
    return process_pb2.StartResponse(
        event=process_pb2.ProcessEvent(
            data=process_pb2.ProcessEvent.DataEvent(stderr=data)
        )
    )


def _end_event(exit_code: int = 0) -> process_pb2.StartResponse:
    return process_pb2.StartResponse(
        event=process_pb2.ProcessEvent(
            end=process_pb2.ProcessEvent.EndEvent(
                exit_code=exit_code, exited=True, status="exited"
            )
        )
    )


async def _kill() -> bool:
    return True


def test_sync_decodes_multibyte_chars_split_across_chunks():
    def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        yield _stdout_event(EMOJI_BYTES[2:] + b"b")
        yield _stderr_event(EMOJI_BYTES[:3])
        yield _stderr_event(EMOJI_BYTES[3:])
        yield _end_event()

    chunks = []
    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())
    result = handle.wait(on_stdout=chunks.append)

    assert result.stdout == f"a{EMOJI}b"
    assert result.stderr == EMOJI
    assert "�" not in result.stdout
    assert "�" not in result.stderr
    assert "".join(chunks) == f"a{EMOJI}b"


def test_sync_replaces_incomplete_trailing_utf8():
    def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        yield _end_event()

    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())
    result = handle.wait()

    assert result.stdout == "a�"


async def test_async_decodes_multibyte_chars_split_across_chunks():
    async def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        yield _stdout_event(EMOJI_BYTES[2:] + b"b")
        yield _stderr_event(EMOJI_BYTES[:3])
        yield _stderr_event(EMOJI_BYTES[3:])
        yield _end_event()

    chunks = []
    handle = AsyncCommandHandle(
        pid=1,
        handle_kill=_kill,
        events=events(),
        on_stdout=chunks.append,
    )
    result = await handle.wait()

    assert result.stdout == f"a{EMOJI}b"
    assert result.stderr == EMOJI
    assert "�" not in result.stdout
    assert "�" not in result.stderr
    assert "".join(chunks) == f"a{EMOJI}b"


async def test_async_replaces_incomplete_trailing_utf8():
    async def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        yield _end_event()

    handle = AsyncCommandHandle(pid=1, handle_kill=_kill, events=events())
    result = await handle.wait()

    assert result.stdout == "a�"
