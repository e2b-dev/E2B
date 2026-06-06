from typing import Iterator

from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.sandbox_async.commands.command import Commands
from e2b.envd.process import process_pb2


def make_start_event(pid: int) -> process_pb2.ConnectResponse:
    return process_pb2.ConnectResponse(
        event=process_pb2.ProcessEvent(
            start=process_pb2.ProcessEvent.StartEvent(pid=pid),
        )
    )


def make_data_event(data: str) -> process_pb2.ConnectResponse:
    return process_pb2.ConnectResponse(
        event=process_pb2.ProcessEvent(
            data=process_pb2.ProcessEvent.DataEvent(stdout=data.encode()),
        )
    )


def make_end_event() -> process_pb2.ConnectResponse:
    return process_pb2.ConnectResponse(
        event=process_pb2.ProcessEvent(
            end=process_pb2.ProcessEvent.EndEvent(exit_code=0),
        )
    )


class FakeAsyncConnectStream:
    def __init__(self, events: list[process_pb2.ConnectResponse]):
        self._events: Iterator[process_pb2.ConnectResponse] = iter(events)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._events)
        except StopIteration as exc:
            raise StopAsyncIteration from exc

    async def aclose(self):
        return None


class FakeProcessClient:
    def __init__(self, events: list[process_pb2.ConnectResponse]):
        self._events = events

    def aconnect(self, *_args, **_kwargs):
        return FakeAsyncConnectStream(self._events)


async def test_connect_replays_non_start_stdout_events():
    big_chunk = "X" * 8192

    events = [
        make_data_event(big_chunk),
        make_start_event(123),
        make_data_event("small\n"),
        make_end_event(),
    ]

    commands = Commands(
        envd_api_url="https://envd.example",
        connection_config=ConnectionConfig(api_key="test-key"),
        pool=None,
        envd_version=Version("0.0.0"),
    )
    commands._rpc = FakeProcessClient(events)

    stdout: list[str] = []
    handle = await commands.connect(123, on_stdout=stdout.append)

    result = await handle.wait()

    assert handle.pid == 123
    assert result.stdout == f"{big_chunk}small\n"
    assert "".join(stdout) == f"{big_chunk}small\n"
