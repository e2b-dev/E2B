import concurrent.futures
import threading
import time
from io import BytesIO
from typing import Any, cast

import httpx
from packaging.version import Version
import pytest

from e2b.connection_config import ConnectionConfig
from e2b.sandbox.filesystem.filesystem import WriteEntry
from e2b.sandbox_sync.filesystem.filesystem import Filesystem
import e2b.sandbox_sync.filesystem.upload_queue as upload_queue_module


class UploadCounter:
    def __init__(self):
        self.active = 0
        self.max_active = 0
        self._lock = threading.Lock()

    def track(self):
        with self._lock:
            self.active += 1
            self.max_active = max(self.max_active, self.active)

        time.sleep(0.01)

        with self._lock:
            self.active -= 1


class FakeResponse:
    content = b""

    def __init__(self, path: str, status_code: int = 200, message: str = ""):
        self._path = path
        self.status_code = status_code
        self.text = message

    @property
    def is_success(self):
        return self.status_code < 400

    def read(self):
        return self.content

    def json(self):
        if not self.is_success:
            return {"message": self.text}

        return [
            {"name": self._path.rsplit("/", 1)[-1], "type": "file", "path": self._path}
        ]


class FakeEnvdApi:
    def __init__(
        self,
        counter: UploadCounter | None = None,
        outcomes: list[Exception | None] | None = None,
    ):
        self.counter = counter or UploadCounter()
        self.outcomes = list(outcomes or [])
        self.calls = 0
        self.contents: list[bytes] = []
        self._lock = threading.Lock()

    def post(self, route, content, headers, params, timeout):
        with self._lock:
            self.calls += 1
            self.contents.append(content)

        self.counter.track()

        with self._lock:
            outcome = self.outcomes.pop(0) if self.outcomes else None

        if isinstance(outcome, Exception):
            raise outcome
        return FakeResponse(params["path"])


def create_filesystem(envd_api: Any, **config_opts) -> Filesystem:
    return Filesystem(
        "https://sandbox.test",
        Version("0.5.11"),
        ConnectionConfig(api_key="test", **config_opts),
        pool=cast(Any, object()),
        envd_api=envd_api,
    )


def test_sync_write_files_limits_octet_stream_upload_concurrency():
    envd_api = FakeEnvdApi()
    filesystem = create_filesystem(envd_api, max_concurrent_file_uploads=2)

    files = [
        WriteEntry(path=f"/tmp/file-{index}.txt", data=f"file {index}")
        for index in range(5)
    ]

    infos = filesystem.write_files(files)

    assert len(infos) == 5
    assert envd_api.counter.max_active == 2


def test_sync_write_files_retries_transient_upload_errors(monkeypatch):
    monkeypatch.setattr(upload_queue_module, "_file_upload_retry_delay", lambda _: 0)
    envd_api = FakeEnvdApi(
        outcomes=[httpx.ReadError("broken"), httpx.ConnectError("no socket"), None]
    )
    filesystem = create_filesystem(
        envd_api,
        max_concurrent_file_uploads=1,
        file_upload_retry_attempts=3,
    )

    infos = filesystem.write_files([WriteEntry(path="/tmp/retry.txt", data="retry")])

    assert len(infos) == 1
    assert envd_api.calls == 3


def test_sync_write_files_retries_io_upload_with_original_content(monkeypatch):
    monkeypatch.setattr(upload_queue_module, "_file_upload_retry_delay", lambda _: 0)
    envd_api = FakeEnvdApi(outcomes=[httpx.ReadError("broken"), None])
    filesystem = create_filesystem(
        envd_api,
        max_concurrent_file_uploads=1,
        file_upload_retry_attempts=2,
    )

    infos = filesystem.write_files(
        [WriteEntry(path="/tmp/retry.bin", data=BytesIO(b"retry body"))]
    )

    assert len(infos) == 1
    assert envd_api.calls == 2
    assert envd_api.contents == [b"retry body", b"retry body"]


def test_sync_write_files_applies_request_timeout_across_upload_retries():
    envd_api = FakeEnvdApi(outcomes=[httpx.ReadError("broken"), None])
    filesystem = create_filesystem(
        envd_api,
        max_concurrent_file_uploads=1,
        file_upload_retry_attempts=2,
    )

    with pytest.raises(TimeoutError):
        filesystem.write_files(
            [WriteEntry(path="/tmp/timeout.txt", data="timeout")],
            request_timeout=0.001,
        )

    assert envd_api.calls == 1


def test_sync_write_files_stops_uploads_after_non_retryable_error():
    envd_api = FakeEnvdApi(outcomes=[RuntimeError("nope")])
    filesystem = create_filesystem(
        envd_api,
        max_concurrent_file_uploads=2,
        file_upload_retry_attempts=1,
    )

    with pytest.raises(RuntimeError, match="nope"):
        filesystem.write_files(
            [
                WriteEntry(path=f"/tmp/abort-{i}.txt", data=f"abort {i}")
                for i in range(10)
            ]
        )

    assert envd_api.calls < 10


def test_sync_write_files_applies_global_upload_concurrency():
    counter = UploadCounter()
    config_opts = {
        "max_concurrent_file_uploads": 5,
        "max_global_concurrent_file_uploads": 2,
    }
    filesystem_a = create_filesystem(FakeEnvdApi(counter=counter), **config_opts)
    filesystem_b = create_filesystem(FakeEnvdApi(counter=counter), **config_opts)

    files_a = [
        WriteEntry(path=f"/tmp/a-{index}.txt", data=f"a {index}") for index in range(3)
    ]
    files_b = [
        WriteEntry(path=f"/tmp/b-{index}.txt", data=f"b {index}") for index in range(3)
    ]

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(filesystem_a.write_files, files_a),
            executor.submit(filesystem_b.write_files, files_b),
        ]
        for future in futures:
            future.result()

    assert counter.max_active == 2
