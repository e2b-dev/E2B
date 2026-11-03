import httpx
import pytest
from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.sandbox_async.filesystem.filesystem import Filesystem as AsyncFilesystem
from e2b.sandbox_sync.filesystem.filesystem import Filesystem as SyncFilesystem

ENVD_URL = "http://envd.e2b.test"
ENVD_VERSION = Version("0.6.0")
FORMATS = ["text", "bytes", "stream"]


def _handler(seen):
    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers.get("accept-encoding"))
        return httpx.Response(200, content=b"hello")

    return handle


def _sync_fs(seen):
    client = httpx.Client(
        base_url=ENVD_URL, transport=httpx.MockTransport(_handler(seen))
    )
    fs = SyncFilesystem(
        ENVD_URL, ENVD_VERSION, ConnectionConfig(api_key="e2b_test"), client
    )
    fs._envd_api_streaming = client
    return fs


def _async_fs(seen):
    client = httpx.AsyncClient(
        base_url=ENVD_URL, transport=httpx.MockTransport(_handler(seen))
    )
    fs = AsyncFilesystem(
        ENVD_URL, ENVD_VERSION, ConnectionConfig(api_key="e2b_test"), client
    )
    fs._envd_api_streaming = client
    return fs


@pytest.mark.parametrize("format", FORMATS)
@pytest.mark.parametrize("gzip,expected", [(False, "identity"), (True, "gzip")])
def test_sync_read_accept_encoding(format, gzip, expected):
    seen = []
    result = _sync_fs(seen).read("/file", format=format, gzip=gzip)
    if format == "stream":
        b"".join(result)
    assert seen == [expected]


@pytest.mark.parametrize("format", FORMATS)
@pytest.mark.parametrize("gzip,expected", [(False, "identity"), (True, "gzip")])
async def test_async_read_accept_encoding(format, gzip, expected):
    seen = []
    result = await _async_fs(seen).read("/file", format=format, gzip=gzip)
    if format == "stream":
        async for _ in result:
            pass
    assert seen == [expected]
