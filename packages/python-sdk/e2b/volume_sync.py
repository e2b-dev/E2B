from typing import List

from typing_extensions import Unpack

from e2b.api import handle_api_exception
from e2b.api.client.api.volumes import (
    post_volumes,
    get_volumes,
    get_volumes_volume_id,
    delete_volumes_volume_id,
)
from e2b.api.client.models import NewVolume as NewVolumeModel, Error
from e2b.api.client_sync import get_api_client
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import NotFoundException
from e2b.volume_info import VolumeInfo


class Volume:
    """E2B Volume for persistent storage that can be mounted to sandboxes."""

    def __init__(self, volume_id: str):
        self._volume_id = volume_id
        self._name = volume_id

    @property
    def volume_id(self) -> str:
        return self._volume_id

    @property
    def name(self) -> str:
        return self._name

    @classmethod
    def create(cls, name: str, **opts: Unpack[ApiParams]) -> "Volume":
        """
        Create a new volume.

        :param name: Name of the volume

        :return: A Volume instance for the new volume
        """
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = post_volumes.sync_detailed(
            body=NewVolumeModel(name=name),
            client=api_client,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        vol = cls(volume_id=res.parsed.id)
        vol._name = res.parsed.name
        return vol

    @staticmethod
    def get_info(volume_id: str, **opts: Unpack[ApiParams]) -> VolumeInfo:
        """
        Get information about a volume.

        :param volume_id: Volume ID

        :return: Volume info
        """
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = get_volumes_volume_id.sync_detailed(
            volume_id,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Volume {volume_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        return VolumeInfo(volume_id=res.parsed.id, name=res.parsed.name)

    @staticmethod
    def list(**opts: Unpack[ApiParams]) -> List[VolumeInfo]:
        """
        List all volumes.

        :return: List of volumes
        """
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = get_volumes.sync_detailed(
            client=api_client,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            return []

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        return [VolumeInfo(volume_id=v.id, name=v.name) for v in res.parsed]

    @staticmethod
    def destroy(volume_id: str, **opts: Unpack[ApiParams]) -> None:
        """
        Destroy a volume.

        :param volume_id: Volume ID
        """
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = delete_volumes_volume_id.sync_detailed(
            volume_id,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Volume {volume_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)
