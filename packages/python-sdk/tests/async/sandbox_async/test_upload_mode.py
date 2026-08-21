"""Async counterpart of `tests/sync/sandbox_sync/test_upload_mode.py`."""

import io
from typing import List

import httpx
from packaging.version import Version

from envd_versions import below_envd_version

from e2b.envd.versions import (
    ENVD_DEBUG_FALLBACK,
    ENVD_OCTET_STREAM_UPLOAD,
)
from e2b.connection_config import ConnectionConfig
from e2b.sandbox_async.filesystem.filesystem import Filesystem

ENVD_URL = "https://49983-sbx-upload-mode.sandbox.e2b.dev"
WRITE_RESPONSE = [{"name": "a.txt", "path": "/home/user/a.txt", "type": "file"}]


def _filesystem(
    api_key: str,
    requests: List[httpx.Request],
    envd_version: str = str(ENVD_DEBUG_FALLBACK),
) -> Filesystem:
    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=WRITE_RESPONSE)

    client = httpx.AsyncClient(
        base_url=ENVD_URL, transport=httpx.MockTransport(handler), timeout=5
    )

    return Filesystem(
        ENVD_URL,
        Version(envd_version),
        ConnectionConfig(api_key=api_key),
        client,
    )


async def test_in_memory_data_uploads_as_multipart(test_api_key):
    requests: List[httpx.Request] = []
    filesystem = _filesystem(test_api_key, requests)

    await filesystem.write("/home/user/a.txt", "hello")

    assert requests[0].headers["Content-Type"].startswith("multipart/form-data")
    assert requests[0].url.params["path"] == "/home/user/a.txt"


async def test_octet_stream_can_be_requested_explicitly(test_api_key):
    requests: List[httpx.Request] = []
    filesystem = _filesystem(test_api_key, requests)

    await filesystem.write("/home/user/a.txt", "hello", use_octet_stream=True)

    assert requests[0].headers["Content-Type"] == "application/octet-stream"
    assert requests[0].content == b"hello"


async def test_file_like_data_defaults_to_octet_stream(test_api_key):
    requests: List[httpx.Request] = []
    filesystem = _filesystem(test_api_key, requests)

    await filesystem.write("/home/user/a.txt", io.BytesIO(b"hello"))

    assert requests[0].headers["Content-Type"] == "application/octet-stream"


async def test_octet_stream_falls_back_to_multipart_on_old_envd(test_api_key):
    requests: List[httpx.Request] = []
    filesystem = _filesystem(
        test_api_key,
        requests,
        envd_version=below_envd_version(ENVD_OCTET_STREAM_UPLOAD),
    )

    await filesystem.write("/home/user/a.txt", io.BytesIO(b"hello"))

    assert requests[0].headers["Content-Type"].startswith("multipart/form-data")


async def test_gzip_implies_octet_stream_and_sets_content_encoding(test_api_key):
    requests: List[httpx.Request] = []
    filesystem = _filesystem(test_api_key, requests)

    await filesystem.write("/home/user/a.txt", "hello", gzip=True)

    assert requests[0].headers["Content-Type"] == "application/octet-stream"
    assert requests[0].headers["Content-Encoding"] == "gzip"
    assert requests[0].content != b"hello"


async def test_metadata_is_sent_as_headers(test_api_key):
    requests: List[httpx.Request] = []
    filesystem = _filesystem(test_api_key, requests)

    await filesystem.write("/home/user/a.txt", "hello", metadata={"origin": "test"})

    assert requests[0].headers["X-Metadata-origin"] == "test"


async def test_multi_file_multipart_upload_omits_path_param(test_api_key):
    requests: List[httpx.Request] = []
    filesystem = _filesystem(test_api_key, requests)

    await filesystem.write_files(
        [
            {"path": "/home/user/a.txt", "data": "a"},
            {"path": "/home/user/b.txt", "data": "b"},
        ]
    )

    assert len(requests) == 1
    assert requests[0].headers["Content-Type"].startswith("multipart/form-data")
    assert "path" not in requests[0].url.params
