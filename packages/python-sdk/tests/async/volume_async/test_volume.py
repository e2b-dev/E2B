from http import HTTPStatus
from uuid import uuid4

import httpx
import pytest
from mock_volume_content import RecordingProxy

from e2b import AsyncVolume
from e2b.exceptions import VolumeNotFoundException
from e2b.api.client.models.volume_and_token import VolumeAndToken
from e2b.api.client.types import Response
import e2b.api.client.api.volumes.post_volumes as post_volumes_mod
import e2b.api.client.api.volumes.get_volumes as get_volumes_mod
import e2b.api.client.api.volumes.get_volumes_volume_id as get_volume_mod
import e2b.api.client.api.volumes.delete_volumes_volume_id as delete_volume_mod

# In-memory store for mock volumes
_volumes: dict[str, VolumeAndToken] = {}


@pytest.fixture(autouse=True)
def mock_volume_api(monkeypatch, test_api_key):
    monkeypatch.setenv("E2B_API_KEY", test_api_key)
    _volumes.clear()

    async def mock_post_volumes(*, client, body):
        vol_id = str(uuid4())
        token = f"vol-token-{uuid4()}"
        vol = VolumeAndToken(volume_id=vol_id, name=body.name, token=token)
        _volumes[vol_id] = vol
        return Response(
            status_code=HTTPStatus(201),
            content=b"",
            headers={},
            parsed=vol,
        )

    async def mock_get_volumes(*, client):
        return Response(
            status_code=HTTPStatus(200),
            content=b"",
            headers={},
            parsed=list(_volumes.values()),
        )

    async def mock_get_volume(volume_id, *, client):
        vol = _volumes.get(volume_id)
        if vol is None:
            return Response(
                status_code=HTTPStatus(404),
                content=b"",
                headers={},
                parsed=None,
            )
        return Response(
            status_code=HTTPStatus(200),
            content=b"",
            headers={},
            parsed=vol,
        )

    async def mock_delete_volume(volume_id, *, client):
        if volume_id not in _volumes:
            return Response(
                status_code=HTTPStatus(404),
                content=b"",
                headers={},
                parsed=None,
            )
        del _volumes[volume_id]
        return Response(
            status_code=HTTPStatus(204),
            content=b"",
            headers={},
            parsed=None,
        )

    monkeypatch.setattr(post_volumes_mod, "asyncio_detailed", mock_post_volumes)
    monkeypatch.setattr(get_volumes_mod, "asyncio_detailed", mock_get_volumes)
    monkeypatch.setattr(get_volume_mod, "asyncio_detailed", mock_get_volume)
    monkeypatch.setattr(delete_volume_mod, "asyncio_detailed", mock_delete_volume)


async def test_create_volume():
    vol = await AsyncVolume.create("test-volume")

    assert vol is not None
    assert vol.volume_id is not None
    assert vol.name == "test-volume"
    assert vol.token is not None


async def test_get_volume_info():
    created = await AsyncVolume.create("info-volume")
    info = await AsyncVolume.get_info(created.volume_id)

    assert info.volume_id == created.volume_id
    assert info.name == "info-volume"
    assert info.token is not None


async def test_list_volumes():
    await AsyncVolume.create("vol-a")
    await AsyncVolume.create("vol-b")

    volumes = await AsyncVolume.list()

    assert len(volumes) == 2
    names = sorted([v.name for v in volumes])
    assert names == ["vol-a", "vol-b"]


async def test_list_volumes_empty():
    volumes = await AsyncVolume.list()
    assert len(volumes) == 0


async def test_destroy_volume():
    vol = await AsyncVolume.create("to-delete")
    result = await AsyncVolume.destroy(vol.volume_id)

    assert result is True

    volumes = await AsyncVolume.list()
    assert len(volumes) == 0


async def test_destroy_nonexistent_volume():
    result = await AsyncVolume.destroy("non-existent-id")
    assert result is False


async def test_get_info_nonexistent_volume():
    with pytest.raises(VolumeNotFoundException):
        await AsyncVolume.get_info("non-existent-id")


@pytest.fixture
def proxy(monkeypatch):
    # Content calls go to https://api.<domain> unless these override it.
    for name in ("E2B_DOMAIN", "E2B_DEBUG", "E2B_VOLUME_API_URL"):
        monkeypatch.delenv(name, raising=False)
    recorder = RecordingProxy()
    yield recorder
    recorder.close()


async def test_create_volume_keeps_proxy_for_content_calls(proxy):
    vol = await AsyncVolume.create(
        "proxy-volume", proxy=proxy.url_with_auth("user", "pass")
    )

    # Instance methods reuse the proxy given to `create`.
    with pytest.raises(httpx.ConnectError):
        await vol.get_info("/file")

    assert set(proxy.tunnels) == {("api.e2b.app:443", "Basic dXNlcjpwYXNz")}


async def test_volume_per_call_proxy_overrides_instance(proxy):
    instance_proxy = RecordingProxy()
    try:
        vol = await AsyncVolume.create("proxy-volume", proxy=instance_proxy.url)

        with pytest.raises(httpx.ConnectError):
            await vol.get_info("/file", proxy=proxy.url)

        assert set(proxy.tunnels) == {("api.e2b.app:443", None)}
        assert instance_proxy.tunnels == []
    finally:
        instance_proxy.close()


async def test_create_volume_uses_byoc_domain(monkeypatch, proxy):
    byoc_domain = "cluster.example.com"

    async def mock_post(*, client, body):
        vol_id = str(uuid4())
        vol = VolumeAndToken.from_dict(
            {
                "volumeID": vol_id,
                "name": body.name,
                "token": f"vol-token-{uuid4()}",
                "domain": byoc_domain,
            }
        )
        _volumes[vol_id] = vol
        return Response(
            status_code=HTTPStatus(201), content=b"", headers={}, parsed=vol
        )

    monkeypatch.setattr(post_volumes_mod, "asyncio_detailed", mock_post)

    vol = await AsyncVolume.create("byoc-volume")

    # The BYOC domain drives the content API destination (https://api.<domain>),
    # replacing the default domain.
    with pytest.raises(httpx.ConnectError):
        await vol.get_info("/file", proxy=proxy.url)

    assert {target for target, _ in proxy.tunnels} == {f"api.{byoc_domain}:443"}


async def test_create_volume_falls_back_to_default_domain(proxy):
    # No domain in the response -> fall back to the connection's domain.
    vol = await AsyncVolume.create("default-volume", domain="custom.example.com")

    with pytest.raises(httpx.ConnectError):
        await vol.get_info("/file", proxy=proxy.url)

    assert {target for target, _ in proxy.tunnels} == {"api.custom.example.com:443"}


async def test_connect_propagates_byoc_domain(proxy):
    byoc_domain = "cluster.example.com"
    created = await AsyncVolume.create("connect-volume")
    _volumes[created.volume_id].domain = byoc_domain

    info = await AsyncVolume.get_info(created.volume_id)
    assert info.domain == byoc_domain

    connected = await AsyncVolume.connect(created.volume_id)
    with pytest.raises(httpx.ConnectError):
        await connected.get_info("/file", proxy=proxy.url)

    assert {target for target, _ in proxy.tunnels} == {f"api.{byoc_domain}:443"}
