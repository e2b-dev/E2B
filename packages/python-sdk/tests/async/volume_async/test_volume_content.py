import httpx
import pytest

from e2b import AsyncVolume
from e2b.exceptions import NotFoundException
import e2b.volume.volume_async as volume_async_mod

_files = {
    "hello.txt": b"hello world",
    "empty.txt": b"",
}


def _handler(request: httpx.Request) -> httpx.Response:
    path = request.url.params.get("path")
    content = _files.get(path)
    if content is None:
        return httpx.Response(404)
    return httpx.Response(200, content=content)


@pytest.fixture
def volume(monkeypatch) -> AsyncVolume:
    real_get_api_client = volume_async_mod.get_volume_api_client

    def mock_get_api_client(config, **kwargs):
        client = real_get_api_client(config, **kwargs)
        client.set_async_httpx_client(
            httpx.AsyncClient(
                base_url=config.api_url,
                transport=httpx.MockTransport(_handler),
            )
        )
        return client

    monkeypatch.setattr(volume_async_mod, "get_volume_api_client", mock_get_api_client)
    return AsyncVolume(volume_id="vol-1", name="test-volume", token="vol-token")


async def test_read_file_stream_yields_content(volume: AsyncVolume):
    stream = await volume.read_file("hello.txt", format="stream")
    chunks = [chunk async for chunk in stream]
    assert b"".join(chunks) == b"hello world"


async def test_read_file_stream_raises_at_call_time_for_missing_path(
    volume: AsyncVolume,
):
    # The request is sent eagerly, so the error surfaces without iterating
    with pytest.raises(NotFoundException):
        await volume.read_file("missing.txt", format="stream")


async def test_read_file_stream_of_empty_file(volume: AsyncVolume):
    stream = await volume.read_file("empty.txt", format="stream")
    chunks = [chunk async for chunk in stream]
    assert b"".join(chunks) == b""


async def test_read_file_text_and_bytes(volume: AsyncVolume):
    assert await volume.read_file("hello.txt") == "hello world"
    assert await volume.read_file("hello.txt", format="bytes") == b"hello world"


async def test_read_file_text_and_bytes_of_empty_file(volume: AsyncVolume):
    assert await volume.read_file("empty.txt") == ""
    assert await volume.read_file("empty.txt", format="bytes") == b""


async def test_read_file_missing_path_raises(volume: AsyncVolume):
    with pytest.raises(NotFoundException):
        await volume.read_file("missing.txt")
