import asyncio

from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.envd.filesystem import filesystem_pb2
from e2b.envd.versions import ENVD_DEFAULT_USER
from e2b.sandbox_async.filesystem.watch_handle import AsyncWatchHandle
from e2b.sandbox_sync.filesystem.watch_handle import WatchHandle


def _fs_event(
    name: str,
    event_type=filesystem_pb2.EventType.EVENT_TYPE_WRITE,
) -> filesystem_pb2.WatchDirResponse:
    return filesystem_pb2.WatchDirResponse(
        filesystem=filesystem_pb2.FilesystemEvent(name=name, type=event_type)
    )


# --- Sync WatchHandle: request timeout + auth header (bug 28) ---


class _FakeSyncRpc:
    def __init__(self):
        self.calls = []

    def get_watcher_events(self, req, **opts):
        self.calls.append(("get_watcher_events", req, opts))
        return filesystem_pb2.GetWatcherEventsResponse(events=[])

    def remove_watcher(self, req, **opts):
        self.calls.append(("remove_watcher", req, opts))
        return filesystem_pb2.RemoveWatcherResponse()


def _make_sync_handle(rpc, envd_version: Version, user=None) -> WatchHandle:
    return WatchHandle(
        get_rpc=lambda: rpc,
        watcher_id="watcher-1",
        connection_config=ConnectionConfig(),
        envd_version=envd_version,
        user=user,
    )


def test_sync_get_new_events_passes_request_timeout_and_auth_header():
    rpc = _FakeSyncRpc()
    # envd < 0.4.0 has no default user, so the auth header must be sent.
    handle = _make_sync_handle(rpc, Version("0.3.0"))

    handle.get_new_events()

    name, _, opts = rpc.calls[0]
    assert name == "get_watcher_events"
    # A request timeout is always supplied so a stalled call can't hang forever.
    assert opts["request_timeout"] == 60.0
    assert opts["headers"].get("Authorization", "").startswith("Basic ")


def test_sync_stop_passes_request_timeout_and_auth_header():
    rpc = _FakeSyncRpc()
    handle = _make_sync_handle(rpc, Version("0.3.0"))

    handle.stop()

    name, _, opts = rpc.calls[0]
    assert name == "remove_watcher"
    assert opts["request_timeout"] == 60.0
    assert opts["headers"].get("Authorization", "").startswith("Basic ")


def test_sync_caller_supplied_request_timeout_is_forwarded():
    rpc = _FakeSyncRpc()
    handle = _make_sync_handle(rpc, ENVD_DEFAULT_USER)

    handle.get_new_events(request_timeout=5)
    handle.stop(request_timeout=7)

    assert rpc.calls[0][2]["request_timeout"] == 5
    assert rpc.calls[1][2]["request_timeout"] == 7
    # No explicit user on a recent envd → no auth header forced.
    assert "Authorization" not in rpc.calls[0][2]["headers"]


# --- Async WatchHandle: on_exit lifecycle (bug 29) ---


async def test_async_on_exit_fires_with_none_on_clean_end():
    async def events():
        yield _fs_event("a.txt")

    received = []
    exit_calls = []

    handle = AsyncWatchHandle(
        events=events(),
        on_event=received.append,
        on_exit=exit_calls.append,
    )

    await handle._wait

    assert [e.name for e in received] == ["a.txt"]
    assert exit_calls == [None]


async def test_async_on_exit_fires_with_error_on_stream_error():
    error = RuntimeError("stream died")

    async def events():
        raise error
        yield  # pragma: no cover - makes this an async generator

    exit_calls = []

    handle = AsyncWatchHandle(
        events=events(),
        on_event=lambda e: None,
        on_exit=exit_calls.append,
    )

    await handle._wait

    assert exit_calls == [error]


async def test_async_on_exit_fires_on_stop():
    started = asyncio.Event()

    async def events():
        started.set()
        await asyncio.Event().wait()  # block until cancelled by stop()
        yield  # pragma: no cover - never reached

    exit_calls = []

    handle = AsyncWatchHandle(
        events=events(),
        on_event=lambda e: None,
        on_exit=exit_calls.append,
    )

    await started.wait()
    await handle.stop()

    assert exit_calls == [None]


async def test_async_on_exit_awaits_async_callback():
    async def events():
        yield _fs_event("a.txt")

    exit_calls = []

    async def on_exit(err):
        exit_calls.append(err)

    handle = AsyncWatchHandle(
        events=events(),
        on_event=lambda e: None,
        on_exit=on_exit,
    )

    await handle._wait

    assert exit_calls == [None]


async def test_async_on_exit_awaits_async_callback_on_stop():
    started = asyncio.Event()

    async def events():
        started.set()
        await asyncio.Event().wait()  # block until cancelled by stop()
        yield  # pragma: no cover - never reached

    exit_done = []

    async def on_exit(err):
        # A real suspension proves the cancellation path drives the async
        # callback to completion rather than dropping it mid-await.
        await asyncio.sleep(0)
        exit_done.append(err)

    handle = AsyncWatchHandle(
        events=events(),
        on_event=lambda e: None,
        on_exit=on_exit,
    )

    await started.wait()
    await handle.stop()

    assert exit_done == [None]


async def test_async_on_exit_error_does_not_leak():
    async def events():
        yield _fs_event("a.txt")

    async def on_exit(err):
        raise RuntimeError("on_exit failed")

    handle = AsyncWatchHandle(
        events=events(),
        on_event=lambda e: None,
        on_exit=on_exit,
    )

    # A raising on_exit must not surface as an unretrieved task exception.
    await handle._wait
    assert handle._wait.done()
    assert handle._wait.exception() is None
