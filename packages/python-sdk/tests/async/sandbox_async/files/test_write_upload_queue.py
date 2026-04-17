import asyncio
from io import BytesIO
from typing import Any, cast

import httpx
from packaging.version import Version
import pytest

from e2b.connection_config import ConnectionConfig
from e2b.sandbox.filesystem.filesystem import WriteEntry
import e2b.sandbox_async.filesystem.filesystem as filesystem_module
from e2b.sandbox_async.filesystem.filesystem import Filesystem


class UploadCounter:
    def __init__(self):
        self.active = 0
        self.max_active = 0

    async def track(self):
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        await asyncio.sleep(0.01)
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

    async def aread(self):
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

    async def post(self, route, content, headers, params, timeout):
        self.calls += 1
        self.contents.append(content)
        await self.counter.track()

        outcome = self.outcomes.pop(0) if self.outcomes else None
        if isinstance(outcome, Exception):
            raise outcome
        return FakeResponse(params["path"])


def create_filesystem(envd_api: FakeEnvdApi) -> Filesystem:
    return Filesystem(
        "https://sandbox.test",
        Version("0.5.11"),
        ConnectionConfig(api_key="test"),
        pool=cast(Any, object()),
        envd_api=cast(Any, envd_api),
    )


async def test_async_write_files_limits_octet_stream_upload_concurrency(monkeypatch):
    monkeypatch.setenv("E2B_MAX_CONCURRENT_FILE_UPLOADS", "2")
    envd_api = FakeEnvdApi()
    filesystem = create_filesystem(envd_api)

    files = [
        WriteEntry(path=f"/tmp/file-{index}.txt", data=f"file {index}")
        for index in range(5)
    ]

    infos = await filesystem.write_files(files)

    assert len(infos) == 5
    assert envd_api.counter.max_active == 2


async def test_async_write_files_retries_transient_upload_errors(monkeypatch):
    monkeypatch.setenv("E2B_MAX_CONCURRENT_FILE_UPLOADS", "1")
    monkeypatch.setenv("E2B_FILE_UPLOAD_RETRY_ATTEMPTS", "3")
    monkeypatch.setattr(filesystem_module, "_file_upload_retry_delay", lambda _: 0)
    envd_api = FakeEnvdApi(
        outcomes=[httpx.ReadError("broken"), httpx.ConnectError("no socket"), None]
    )
    filesystem = create_filesystem(envd_api)

    infos = await filesystem.write_files(
        [WriteEntry(path="/tmp/retry.txt", data="retry")]
    )

    assert len(infos) == 1
    assert envd_api.calls == 3


async def test_async_write_files_retries_io_upload_with_original_content(monkeypatch):
    monkeypatch.setenv("E2B_MAX_CONCURRENT_FILE_UPLOADS", "1")
    monkeypatch.setenv("E2B_FILE_UPLOAD_RETRY_ATTEMPTS", "2")
    monkeypatch.setattr(filesystem_module, "_file_upload_retry_delay", lambda _: 0)
    envd_api = FakeEnvdApi(outcomes=[httpx.ReadError("broken"), None])
    filesystem = create_filesystem(envd_api)

    infos = await filesystem.write_files(
        [WriteEntry(path="/tmp/retry.bin", data=BytesIO(b"retry body"))]
    )

    assert len(infos) == 1
    assert envd_api.calls == 2
    assert envd_api.contents == [b"retry body", b"retry body"]


async def test_async_write_files_stops_uploads_after_non_retryable_error(
    monkeypatch,
):
    monkeypatch.setenv("E2B_MAX_CONCURRENT_FILE_UPLOADS", "2")
    monkeypatch.setenv("E2B_FILE_UPLOAD_RETRY_ATTEMPTS", "1")
    # First upload raises a non-retryable error; remaining files should be skipped.
    envd_api = FakeEnvdApi(outcomes=[RuntimeError("nope")])
    filesystem = create_filesystem(envd_api)

    with pytest.raises(RuntimeError, match="nope"):
        await filesystem.write_files(
            [
                WriteEntry(path=f"/tmp/abort-{i}.txt", data=f"abort {i}")
                for i in range(10)
            ]
        )

    assert envd_api.calls < 10


async def test_async_write_files_applies_global_upload_concurrency(monkeypatch):
    monkeypatch.setenv("E2B_MAX_CONCURRENT_FILE_UPLOADS", "5")
    monkeypatch.setenv("E2B_MAX_GLOBAL_CONCURRENT_FILE_UPLOADS", "2")
    counter = UploadCounter()
    filesystem_a = create_filesystem(FakeEnvdApi(counter=counter))
    filesystem_b = create_filesystem(FakeEnvdApi(counter=counter))

    files_a = [
        WriteEntry(path=f"/tmp/a-{index}.txt", data=f"a {index}") for index in range(3)
    ]
    files_b = [
        WriteEntry(path=f"/tmp/b-{index}.txt", data=f"b {index}") for index in range(3)
    ]

    await asyncio.gather(
        filesystem_a.write_files(files_a),
        filesystem_b.write_files(files_b),
    )

    assert counter.max_active == 2
