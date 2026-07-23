"""Client lifecycle in the sync sandbox modules: the httpx `envd_api` clients
wrap per-thread transports (see `e2b.api.client_sync`) and are bound per
calling thread, while the connectrpc RPC clients are stateless over a
process-global transport and are built once per module and shared across
threads."""

from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import threading
from types import SimpleNamespace
from typing import cast
from unittest.mock import Mock, sentinel

import httpx
from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.envd.filesystem.filesystem_connect import FilesystemClientSync
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


def test_sync_sandbox_rpc_shared_and_envd_api_per_thread(monkeypatch, test_api_key):
    config = ConnectionConfig(api_key=test_api_key)
    created = []
    transports = {}
    lock = threading.Lock()

    def get_transport(*_args, **_kwargs):
        thread_id = threading.get_ident()
        with lock:
            transport = transports.get(thread_id)
            if transport is None:
                transport = object()
                transports[thread_id] = transport
            return transport

    def record(kind):
        with lock:
            created.append((kind, threading.get_ident()))

    class FakeHttpClient:
        def __init__(self, *args, **kwargs):
            self.transport = kwargs["transport"]
            record("http")

    def fake_create_rpc_client(client_cls, base_url, config):
        record(
            "filesystem_rpc" if "Filesystem" in client_cls.__name__ else "process_rpc"
        )
        return object()

    monkeypatch.setattr(filesystem_sync, "get_envd_transport", get_transport)
    monkeypatch.setattr(filesystem_sync.httpx, "Client", FakeHttpClient)
    monkeypatch.setattr(filesystem_sync, "create_rpc_client", fake_create_rpc_client)
    monkeypatch.setattr(command_sync, "create_rpc_client", fake_create_rpc_client)
    monkeypatch.setattr(pty_sync, "create_rpc_client", fake_create_rpc_client)

    main_thread_id = threading.get_ident()
    sandbox = sandbox_sync_main.Sandbox(
        sandbox_id="sbx-test",
        sandbox_domain="e2b.app",
        envd_version=ENVD_VERSION,
        envd_access_token="tok",
        traffic_access_token="tok",
        connection_config=config,
    )

    # RPC clients are built eagerly, once, on the constructing thread.
    assert Counter(kind for kind, thread in created if thread == main_thread_id) == {
        "filesystem_rpc": 1,
        "process_rpc": 2,
    }

    main_rpcs = (sandbox.files._rpc, sandbox.commands._rpc, sandbox.pty._rpc)

    worker_count = 10
    barrier = threading.Barrier(worker_count + 1)

    def worker():
        barrier.wait()
        envd_api = sandbox._envd_api
        files_envd_api = sandbox.files._envd_api

        return {
            "thread": threading.get_ident(),
            "same_envd_api": envd_api is files_envd_api,
            "stable": (
                envd_api is sandbox._envd_api
                and files_envd_api is sandbox.files._envd_api
            ),
            "same_rpcs": (
                sandbox.files._rpc,
                sandbox.commands._rpc,
                sandbox.pty._rpc,
            )
            == main_rpcs,
        }

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = [executor.submit(worker) for _ in range(worker_count)]
        barrier.wait()
        results = [future.result() for future in futures]

    worker_threads = {result["thread"] for result in results}
    worker_created = [
        (kind, thread) for kind, thread in created if thread in worker_threads
    ]

    assert Counter(result["same_envd_api"] for result in results) == {
        True: worker_count
    }
    assert Counter(result["stable"] for result in results) == {True: worker_count}
    assert Counter(result["same_rpcs"] for result in results) == {True: worker_count}
    # Worker threads build only their per-thread httpx client — no RPC clients.
    assert Counter(kind for kind, _thread in worker_created) == {
        "http": worker_count,
    }


def test_sync_filesystem_envd_api_per_thread_rpc_shared(monkeypatch, test_api_key):
    config = ConnectionConfig(api_key=test_api_key)
    main_thread_id = threading.get_ident()
    main_transport = object()
    worker_transport = object()
    main_api = Mock(spec=httpx.Client)
    worker_api = Mock(spec=httpx.Client)
    shared_rpc = sentinel.filesystem_rpc

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
        filesystem_sync,
        "create_rpc_client",
        lambda *_args, **_kwargs: shared_rpc,
    )

    fs = Filesystem(
        ENVD_API_URL,
        ENVD_VERSION,
        config,
    )

    assert fs._envd_api is main_api
    assert fs._rpc is shared_rpc

    worker_api_result, worker_rpc_result = run_in_worker_thread(
        lambda: (fs._envd_api, fs._rpc)
    )
    assert worker_api_result is worker_api
    assert worker_rpc_result is shared_rpc
    assert fs._envd_api is main_api


def test_sync_command_rpc_client_is_shared_across_threads(monkeypatch, test_api_key):
    config = ConnectionConfig(api_key=test_api_key)
    created = []

    def fake_create_rpc_client(*_args, **_kwargs):
        rpc = object()
        created.append(rpc)
        return rpc

    monkeypatch.setattr(command_sync, "create_rpc_client", fake_create_rpc_client)

    commands = Commands(ENVD_API_URL, config, ENVD_VERSION)

    assert created == [commands._rpc]
    assert run_in_worker_thread(lambda: commands._rpc) is created[0]
    assert created == [commands._rpc]


def test_sync_pty_rpc_client_is_shared_across_threads(monkeypatch, test_api_key):
    config = ConnectionConfig(api_key=test_api_key)
    created = []

    def fake_create_rpc_client(*_args, **_kwargs):
        rpc = object()
        created.append(rpc)
        return rpc

    monkeypatch.setattr(pty_sync, "create_rpc_client", fake_create_rpc_client)

    pty = Pty(ENVD_API_URL, config, ENVD_VERSION)

    assert created == [pty._rpc]
    assert run_in_worker_thread(lambda: pty._rpc) is created[0]
    assert created == [pty._rpc]


def test_sync_watch_handle_uses_given_rpc(test_api_key):
    class FakeRpc:
        def __init__(self, name):
            self.name = name
            self.calls = []

        def remove_watcher(self, request, **opts):
            self.calls.append(("remove", request.watcher_id))

    config = ConnectionConfig(api_key=test_api_key)

    rpc = FakeRpc("shared")
    handle = WatchHandle(
        cast(FilesystemClientSync, rpc), "watcher-id", config, ENVD_VERSION
    )

    handle.stop()
    assert rpc.calls == [("remove", "watcher-id")]

    rpc = FakeRpc("shared")
    handle = WatchHandle(
        cast(FilesystemClientSync, rpc), "watcher-id", config, ENVD_VERSION
    )
    run_in_worker_thread(handle.stop)
    assert rpc.calls == [("remove", "watcher-id")]
