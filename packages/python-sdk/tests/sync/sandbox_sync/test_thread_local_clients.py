from concurrent.futures import ThreadPoolExecutor
import threading
from types import SimpleNamespace
from unittest.mock import Mock, sentinel

import httpx
from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.sandbox_sync.commands.command import Commands
from e2b.sandbox_sync.commands.pty import Pty
from e2b.sandbox_sync.filesystem import filesystem as filesystem_sync
from e2b.sandbox_sync.filesystem.filesystem import Filesystem
from e2b.sandbox_sync.filesystem.watch_handle import WatchHandle
import e2b.sandbox_sync.commands.command as command_sync
import e2b.sandbox_sync.commands.pty as pty_sync
import e2b.sandbox_sync.main as sandbox_sync_main


ENVD_API_URL = "https://sandbox.e2b.app"
ENVD_VERSION = Version("0.6.2")


def run_in_worker_thread(fn):
    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(fn).result()


def fake_transport():
    return SimpleNamespace(pool=object())


def test_sync_sandbox_envd_api_is_bound_per_calling_thread(monkeypatch, test_api_key):
    config = ConnectionConfig(api_key=test_api_key)
    main_api = Mock(spec=httpx.Client)
    filesystem = SimpleNamespace(_envd_api=main_api)

    monkeypatch.setattr(
        sandbox_sync_main, "Filesystem", lambda *args, **kwargs: filesystem
    )
    monkeypatch.setattr(sandbox_sync_main, "Commands", lambda *args, **kwargs: object())
    monkeypatch.setattr(sandbox_sync_main, "Pty", lambda *args, **kwargs: object())
    monkeypatch.setattr(sandbox_sync_main, "Git", lambda *args, **kwargs: object())

    sandbox = sandbox_sync_main.Sandbox(
        sandbox_id="sbx-test",
        sandbox_domain="e2b.app",
        envd_version=ENVD_VERSION,
        envd_access_token="tok",
        traffic_access_token="tok",
        connection_config=config,
    )

    assert sandbox._envd_api is main_api
    assert sandbox._envd_api is sandbox.files._envd_api
    assert not hasattr(sandbox, "_transport")


def test_sync_filesystem_envd_clients_are_bound_per_calling_thread(
    monkeypatch, test_api_key
):
    config = ConnectionConfig(api_key=test_api_key)
    main_thread_id = threading.get_ident()
    main_transport = fake_transport()
    worker_transport = fake_transport()
    main_api = Mock(spec=httpx.Client)
    worker_api = Mock(spec=httpx.Client)
    main_rpc = sentinel.main_filesystem_rpc
    worker_rpc = sentinel.worker_filesystem_rpc

    monkeypatch.setattr(
        filesystem_sync,
        "get_envd_transport",
        lambda *_args, **_kwargs: main_transport
        if threading.get_ident() == main_thread_id
        else worker_transport,
    )
    monkeypatch.setattr(
        filesystem_sync.httpx,
        "Client",
        lambda *args, **kwargs: main_api
        if kwargs["transport"] is main_transport
        else worker_api,
    )
    monkeypatch.setattr(
        filesystem_sync.filesystem_connect,
        "FilesystemClient",
        lambda *args, **kwargs: main_rpc
        if kwargs["pool"] is main_transport.pool
        else worker_rpc,
    )

    fs = Filesystem(
        ENVD_API_URL,
        ENVD_VERSION,
        config,
    )

    assert fs._envd_api is main_api
    assert fs._rpc is main_rpc

    worker_api_result, worker_rpc_result = run_in_worker_thread(
        lambda: (fs._envd_api, fs._rpc)
    )
    assert worker_api_result is worker_api
    assert worker_rpc_result is worker_rpc
    assert fs._envd_api is main_api
    assert fs._rpc is main_rpc


def test_sync_command_rpc_clients_are_bound_per_calling_thread(
    monkeypatch, test_api_key
):
    config = ConnectionConfig(api_key=test_api_key)
    main_thread_id = threading.get_ident()
    main_transport = fake_transport()
    worker_transport = fake_transport()
    main_rpc = sentinel.main_command_rpc
    worker_rpc = sentinel.worker_command_rpc

    monkeypatch.setattr(
        command_sync,
        "get_envd_transport",
        lambda *_args, **_kwargs: main_transport
        if threading.get_ident() == main_thread_id
        else worker_transport,
    )
    monkeypatch.setattr(
        command_sync.process_connect,
        "ProcessClient",
        lambda *args, **kwargs: main_rpc
        if kwargs["pool"] is main_transport.pool
        else worker_rpc,
    )

    commands = Commands(ENVD_API_URL, config, ENVD_VERSION)

    assert commands._rpc is main_rpc
    worker_rpc_result = run_in_worker_thread(lambda: commands._rpc)
    assert worker_rpc_result is worker_rpc
    assert commands._rpc is main_rpc


def test_sync_pty_rpc_clients_are_bound_per_calling_thread(monkeypatch, test_api_key):
    config = ConnectionConfig(api_key=test_api_key)
    main_thread_id = threading.get_ident()
    main_transport = fake_transport()
    worker_transport = fake_transport()
    main_rpc = sentinel.main_pty_rpc
    worker_rpc = sentinel.worker_pty_rpc

    monkeypatch.setattr(
        pty_sync,
        "get_envd_transport",
        lambda *_args, **_kwargs: main_transport
        if threading.get_ident() == main_thread_id
        else worker_transport,
    )
    monkeypatch.setattr(
        pty_sync.process_connect,
        "ProcessClient",
        lambda *args, **kwargs: main_rpc
        if kwargs["pool"] is main_transport.pool
        else worker_rpc,
    )

    pty = Pty(ENVD_API_URL, config, ENVD_VERSION)

    assert pty._rpc is main_rpc
    worker_rpc_result = run_in_worker_thread(lambda: pty._rpc)
    assert worker_rpc_result is worker_rpc
    assert pty._rpc is main_rpc


def test_sync_watch_handle_uses_calling_thread_rpc():
    class FakeRpc:
        def __init__(self, name):
            self.name = name
            self.calls = []

        def remove_watcher(self, request):
            self.calls.append(("remove", request.watcher_id))

    main_rpc = FakeRpc("main")
    worker_rpc = FakeRpc("worker")
    handle = WatchHandle(lambda: main_rpc, "watcher-id")

    handle.stop()
    assert main_rpc.calls == [("remove", "watcher-id")]

    handle = WatchHandle(lambda: worker_rpc, "watcher-id")
    run_in_worker_thread(handle.stop)
    assert worker_rpc.calls == [("remove", "watcher-id")]
