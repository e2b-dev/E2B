from packaging.version import Version
import pytest
import threading

from e2b.envd.process import process_pb2
from e2b.sandbox_async.commands.command import Commands as AsyncCommands
from e2b.sandbox_sync.commands.command import Commands as SyncCommands


class _ConnectionConfig:
    sandbox_headers = {}

    def get_request_timeout(self, request_timeout):
        return request_timeout


def _start_response(pid=123):
    return process_pb2.StartResponse(
        event=process_pb2.ProcessEvent(
            start=process_pb2.ProcessEvent.StartEvent(pid=pid),
        ),
    )


class _SyncRpc:
    def __init__(self):
        self.start_request = None
        self.connect_request = None

    def start(self, request, **_kwargs):
        self.start_request = request
        yield _start_response()

    def connect(self, request, **_kwargs):
        self.connect_request = request
        yield _start_response()


class _AsyncRpc:
    def __init__(self):
        self.start_request = None
        self.connect_request = None

    async def _events(self):
        yield _start_response()

    def astart(self, request, **_kwargs):
        self.start_request = request
        return self._events()

    def aconnect(self, request, **_kwargs):
        self.connect_request = request
        return self._events()


def _sync_commands(rpc):
    commands = object.__new__(SyncCommands)
    commands._connection_config = _ConnectionConfig()
    commands._envd_version = Version("0.0.0")
    commands._thread_local = threading.local()
    commands._thread_local.rpc = rpc
    commands._check_health = lambda: None
    return commands


def _async_commands(rpc):
    commands = object.__new__(AsyncCommands)
    commands._connection_config = _ConnectionConfig()
    commands._envd_version = Version("0.0.0")
    commands._rpc = rpc
    commands._check_health = lambda: None
    return commands


def test_sync_run_passes_command_tag_to_envd():
    rpc = _SyncRpc()
    commands = _sync_commands(rpc)

    handle = commands.run("python long_job.py", background=True, tag="agent-job-42")

    assert handle.pid == 123
    assert rpc.start_request.tag == "agent-job-42"


def test_sync_connect_can_select_command_by_tag():
    rpc = _SyncRpc()
    commands = _sync_commands(rpc)

    handle = commands.connect(tag="agent-job-42")

    assert handle.pid == 123
    assert rpc.connect_request.process.WhichOneof("selector") == "tag"
    assert rpc.connect_request.process.tag == "agent-job-42"


def test_sync_connect_requires_exactly_one_selector():
    commands = _sync_commands(_SyncRpc())

    with pytest.raises(ValueError, match="Exactly one"):
        commands.connect()

    with pytest.raises(ValueError, match="Exactly one"):
        commands.connect(pid=123, tag="agent-job-42")


@pytest.mark.asyncio
async def test_async_run_passes_command_tag_to_envd():
    rpc = _AsyncRpc()
    commands = _async_commands(rpc)

    handle = await commands.run(
        "python long_job.py", background=True, tag="agent-job-42"
    )
    await handle.disconnect()

    assert handle.pid == 123
    assert rpc.start_request.tag == "agent-job-42"


@pytest.mark.asyncio
async def test_async_connect_can_select_command_by_tag():
    rpc = _AsyncRpc()
    commands = _async_commands(rpc)

    handle = await commands.connect(tag="agent-job-42")
    await handle.disconnect()

    assert handle.pid == 123
    assert rpc.connect_request.process.WhichOneof("selector") == "tag"
    assert rpc.connect_request.process.tag == "agent-job-42"


@pytest.mark.asyncio
async def test_async_connect_requires_exactly_one_selector():
    commands = _async_commands(_AsyncRpc())

    with pytest.raises(ValueError, match="Exactly one"):
        await commands.connect()

    with pytest.raises(ValueError, match="Exactly one"):
        await commands.connect(pid=123, tag="agent-job-42")
