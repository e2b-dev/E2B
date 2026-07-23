"""Client lifecycle in the sync sandbox modules: the httpx `envd_api` clients
wrap per-thread transports (see `e2b.api.client_sync`) and are bound per
calling thread, while the connectrpc RPC clients are stateless over a
process-global transport and are built once per module and shared across
threads."""

from concurrent.futures import ThreadPoolExecutor
import threading
from types import SimpleNamespace
from unittest.mock import Mock, sentinel

import httpx
from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.sandbox_sync.filesystem import filesystem as filesystem_sync
from e2b.sandbox_sync.filesystem.filesystem import Filesystem
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
