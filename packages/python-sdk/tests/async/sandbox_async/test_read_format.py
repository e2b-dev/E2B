"""Async counterpart of `tests/sync/sandbox_sync/test_read_format.py`."""

from typing import List

import httpx
import pytest
from packaging.version import Version

from envd_versions import below_envd_version

import e2b.sandbox_async.filesystem.filesystem as filesystem_module
from e2b.envd.versions import (
    ENVD_DEBUG_FALLBACK,
    ENVD_DEFAULT_USER,
)
from e2b.connection_config import ConnectionConfig, default_username
from e2b.exceptions import FileNotFoundException
from e2b.sandbox_async.filesystem.filesystem import Filesystem

ENVD_URL = "https://49983-sbx-read-format.sandbox.e2b.dev"
FILE_CONTENT = "hello from envd"


def _filesystem(
    monkeypatch,
    api_key: str,
    requests: List[httpx.Request],
    envd_version: str = str(ENVD_DEBUG_FALLBACK),
    status_code: int = 200,
) -> Filesystem:
    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if status_code != 200:
            return httpx.Response(status_code, json={"message": "file not found"})
        return httpx.Response(200, text=FILE_CONTENT)

    client = httpx.AsyncClient(
        base_url=ENVD_URL, transport=httpx.MockTransport(handler), timeout=5
    )
    # Streamed reads use a sibling client built by `get_envd_api`; point it at
    # the same mock transport.
    monkeypatch.setattr(
        filesystem_module, "get_envd_api", lambda *args, **kwargs: client
    )

    return Filesystem(
        ENVD_URL,
        Version(envd_version),
        ConnectionConfig(api_key=api_key),
        client,
    )


async def test_read_returns_text_by_default(monkeypatch, test_api_key):
    requests: List[httpx.Request] = []
    filesystem = _filesystem(monkeypatch, test_api_key, requests)

    assert await filesystem.read("/home/user/a.txt") == FILE_CONTENT

    assert len(requests) == 1
    assert requests[0].url.params["path"] == "/home/user/a.txt"
    assert "username" not in requests[0].url.params
    # httpx sends its own Accept-Encoding; the SDK only overrides it for gzip.
    assert requests[0].headers["Accept-Encoding"] != "gzip"


async def test_read_returns_bytes(monkeypatch, test_api_key):
    filesystem = _filesystem(monkeypatch, test_api_key, [])

    content = await filesystem.read("/home/user/a.txt", format="bytes")

    assert isinstance(content, bytearray)
    assert content == bytearray(FILE_CONTENT.encode())


async def test_read_returns_stream(monkeypatch, test_api_key):
    filesystem = _filesystem(monkeypatch, test_api_key, [])

    stream = await filesystem.read("/home/user/a.txt", format="stream")
    chunks = [chunk async for chunk in stream]
    assert b"".join(chunks) == FILE_CONTENT.encode()


async def test_read_sends_default_username_on_old_envd(monkeypatch, test_api_key):
    requests: List[httpx.Request] = []
    filesystem = _filesystem(
        monkeypatch,
        test_api_key,
        requests,
        envd_version=below_envd_version(ENVD_DEFAULT_USER),
    )

    await filesystem.read("/home/user/a.txt")

    assert requests[0].url.params["username"] == default_username


async def test_read_negotiates_gzip(monkeypatch, test_api_key):
    requests: List[httpx.Request] = []
    filesystem = _filesystem(monkeypatch, test_api_key, requests)

    await filesystem.read("/home/user/a.txt", gzip=True)

    assert requests[0].headers["Accept-Encoding"] == "gzip"


async def test_read_maps_404_to_file_not_found(monkeypatch, test_api_key):
    filesystem = _filesystem(monkeypatch, test_api_key, [], status_code=404)

    with pytest.raises(FileNotFoundException):
        await filesystem.read("/home/user/missing.txt")
