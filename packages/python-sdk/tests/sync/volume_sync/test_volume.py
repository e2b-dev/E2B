from http import HTTPStatus
from uuid import uuid4

import pytest

from e2b import Volume
from e2b.exceptions import NotFoundException
from e2b.api.client.models.volume import Volume as VolumeModel
from e2b.api.client.types import Response
import e2b.api.client.api.volumes.post_volumes as post_volumes_mod
import e2b.api.client.api.volumes.get_volumes as get_volumes_mod
import e2b.api.client.api.volumes.get_volumes_volume_id as get_volume_mod
import e2b.api.client.api.volumes.delete_volumes_volume_id as delete_volume_mod

# In-memory store for mock volumes
_volumes: dict[str, VolumeModel] = {}


@pytest.fixture(autouse=True)
def mock_volume_api(monkeypatch):
    _volumes.clear()

    def mock_post_volumes(*, client, body):
        vol_id = str(uuid4())
        vol = VolumeModel(volume_id=vol_id, name=body.name)
        _volumes[vol_id] = vol
        return Response(
            status_code=HTTPStatus(201),
            content=b"",
            headers={},
            parsed=vol,
        )

    def mock_get_volumes(*, client):
        return Response(
            status_code=HTTPStatus(200),
            content=b"",
            headers={},
            parsed=list(_volumes.values()),
        )

    def mock_get_volume(volume_id, *, client):
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

    def mock_delete_volume(volume_id, *, client):
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

    monkeypatch.setattr(post_volumes_mod, "sync_detailed", mock_post_volumes)
    monkeypatch.setattr(get_volumes_mod, "sync_detailed", mock_get_volumes)
    monkeypatch.setattr(get_volume_mod, "sync_detailed", mock_get_volume)
    monkeypatch.setattr(delete_volume_mod, "sync_detailed", mock_delete_volume)


def test_create_volume():
    vol = Volume.create("test-volume")

    assert vol is not None
    assert vol.volume_id is not None
    assert vol.name == "test-volume"


def test_get_volume_info():
    created = Volume.create("info-volume")
    info = Volume.get_info(created.volume_id)

    assert info.volume_id == created.volume_id
    assert info.name == "info-volume"


def test_list_volumes():
    Volume.create("vol-a")
    Volume.create("vol-b")

    volumes = Volume.list()

    assert len(volumes) == 2
    names = sorted([v.name for v in volumes])
    assert names == ["vol-a", "vol-b"]


def test_list_volumes_empty():
    volumes = Volume.list()
    assert len(volumes) == 0


def test_destroy_volume():
    vol = Volume.create("to-delete")
    result = Volume.destroy(vol.volume_id)

    assert result is True

    volumes = Volume.list()
    assert len(volumes) == 0


def test_destroy_nonexistent_volume():
    result = Volume.destroy("non-existent-id")
    assert result is False


def test_get_info_nonexistent_volume():
    with pytest.raises(NotFoundException):
        Volume.get_info("non-existent-id")


def test_volume_full_lifecycle():
    # Create
    vol = Volume.create("lifecycle-vol")
    assert vol.name == "lifecycle-vol"

    # Get info
    info = Volume.get_info(vol.volume_id)
    assert info.name == "lifecycle-vol"

    # List
    volumes = Volume.list()
    assert len(volumes) == 1
    assert volumes[0].volume_id == vol.volume_id

    # Destroy
    destroyed = Volume.destroy(vol.volume_id)
    assert destroyed is True

    # List again
    volumes = Volume.list()
    assert len(volumes) == 0
