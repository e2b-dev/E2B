import httpx
import pytest

from e2b import Volume
from e2b.exceptions import VolumePathNotFoundException
import e2b.volume.volume_sync as volume_sync_mod

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
def volume(monkeypatch) -> Volume:
    def mock(real_get_api_client):
        def mock_get_api_client(config, **kwargs):
            client = real_get_api_client(config, **kwargs)
            client.set_httpx_client(
                httpx.Client(
                    base_url=config.api_url,
                    transport=httpx.MockTransport(_handler),
                )
            )
            return client

        return mock_get_api_client

    # Streamed reads run on their own client (the streaming transport), so
    # both factories need the mock transport.
    for name in ("get_volume_api_client", "get_streaming_volume_api_client"):
        monkeypatch.setattr(volume_sync_mod, name, mock(getattr(volume_sync_mod, name)))
    return Volume(volume_id="vol-1", name="test-volume", token="vol-token")


def test_read_file_stream_yields_content(volume: Volume):
    stream = volume.read_file("hello.txt", format="stream")
    assert b"".join(stream) == b"hello world"


def test_read_file_stream_raises_for_missing_path(volume: Volume):
    with pytest.raises(VolumePathNotFoundException):
        for _ in volume.read_file("missing.txt", format="stream"):
            pass


def test_read_file_stream_of_empty_file(volume: Volume):
    stream = volume.read_file("empty.txt", format="stream")
    assert b"".join(stream) == b""


def test_read_file_text_and_bytes(volume: Volume):
    assert volume.read_file("hello.txt") == "hello world"
    assert volume.read_file("hello.txt", format="bytes") == b"hello world"


def test_read_file_text_and_bytes_of_empty_file(volume: Volume):
    assert volume.read_file("empty.txt") == ""
    assert volume.read_file("empty.txt", format="bytes") == b""


def test_read_file_missing_path_raises(volume: Volume):
    with pytest.raises(VolumePathNotFoundException):
        volume.read_file("missing.txt")
