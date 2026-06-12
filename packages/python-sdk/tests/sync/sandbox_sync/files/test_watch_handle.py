from unittest.mock import MagicMock

from e2b.connection_config import ConnectionConfig
from e2b.sandbox_sync.filesystem.watch_handle import WatchHandle


def make_handle(rpc):
    rpc.get_watcher_events.return_value = MagicMock(events=[])
    return WatchHandle(
        lambda: rpc,
        "watcher-id",
        ConnectionConfig(),
        headers={"Authorization": "Basic dXNlcjo="},
    )


def test_get_new_events_passes_timeout_and_headers():
    rpc = MagicMock()
    handle = make_handle(rpc)

    handle.get_new_events(request_timeout=12)

    _, kwargs = rpc.get_watcher_events.call_args
    assert kwargs["request_timeout"] == 12
    assert kwargs["headers"] == {"Authorization": "Basic dXNlcjo="}


def test_get_new_events_uses_default_timeout():
    rpc = MagicMock()
    handle = make_handle(rpc)

    handle.get_new_events()

    _, kwargs = rpc.get_watcher_events.call_args
    assert kwargs["request_timeout"] is not None


def test_stop_passes_timeout_and_headers():
    rpc = MagicMock()
    handle = make_handle(rpc)

    handle.stop(request_timeout=34)

    _, kwargs = rpc.remove_watcher.call_args
    assert kwargs["request_timeout"] == 34
    assert kwargs["headers"] == {"Authorization": "Basic dXNlcjo="}
