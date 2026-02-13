from typing import AsyncIterator, IO, List, Literal, Optional, Union, overload
from http import HTTPStatus

from typing_extensions import Unpack

from e2b.api import handle_api_exception
from e2b.api.client.api.volumes import (
    post_volumes,
    get_volumes,
    get_volumes_volume_id,
    delete_volumes_volume_id,
    get_volumes_volume_id_stat,
)
from e2b.api.client.models import (
    NewVolume as NewVolumeModel,
    Error,
    VolumeDirectoryListing,
)
from e2b.api.client.types import Response
from e2b.api.client_async import get_api_client
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import NotFoundException
from e2b.volume.types import (
    VolumeInfo,
    VolumeEntryStat,
)


class AsyncVolume:
    """E2B Volume for persistent storage that can be mounted to sandboxes (async)."""

    def __init__(self, volume_id: str, name: Optional[str] = None):
        self._volume_id = volume_id
        self._name = name if name is not None else volume_id

    @property
    def volume_id(self) -> str:
        return self._volume_id

    @property
    def name(self) -> str:
        return self._name

    @classmethod
    async def create(cls, name: str, **opts: Unpack[ApiParams]) -> "AsyncVolume":
        """
        Create a new volume.

        :param name: Name of the volume

        :return: An AsyncVolume instance for the new volume
        """
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = await post_volumes.asyncio_detailed(
            body=NewVolumeModel(name=name),
            client=api_client,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        vol = cls(volume_id=res.parsed.volume_id)
        vol._name = res.parsed.name
        return vol

    @staticmethod
    async def get_info(volume_id: str, **opts: Unpack[ApiParams]) -> VolumeInfo:
        """
        Get information about a volume.

        :param volume_id: Volume ID

        :return: Volume info
        """
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = await get_volumes_volume_id.asyncio_detailed(
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

        return VolumeInfo(volume_id=res.parsed.volume_id, name=res.parsed.name)

    @staticmethod
    async def list(**opts: Unpack[ApiParams]) -> List[VolumeInfo]:
        """
        List all volumes.

        :return: List of volumes
        """
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = await get_volumes.asyncio_detailed(
            client=api_client,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            return []

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        return [VolumeInfo(volume_id=v.volume_id, name=v.name) for v in res.parsed]

    @staticmethod
    async def destroy(volume_id: str, **opts: Unpack[ApiParams]) -> bool:
        """
        Destroy a volume.

        :param volume_id: Volume ID
        """
        config = ConnectionConfig(**opts)

        api_client = get_api_client(config)
        res = await delete_volumes_volume_id.asyncio_detailed(
            volume_id,
            client=api_client,
        )

        if res.status_code == 404:
            return False

        if res.status_code >= 300:
            raise handle_api_exception(res)

        return True

    async def list_items(
        self, path: str, **opts: Unpack[ApiParams]
    ) -> List[VolumeEntryStat]:
        """
        List directory contents.

        :param path: Path to the directory
        :param opts: Connection options

        :return: List of items (files and directories) in the directory
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        params = {"path": path}
        response = await api_client.get_async_httpx_client().request(
            method="GET",
            url=f"/volumes/{self._volume_id}/dir",
            params=params,
            timeout=config.get_request_timeout(opts.get("request_timeout")),
        )

        if response.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if response.status_code >= 300:
            api_response = Response(
                status_code=HTTPStatus(response.status_code),
                content=response.content,
                headers=response.headers,
                parsed=None,
            )
            err = handle_api_exception(api_response)
            if err:
                raise err

        # Parse the response - it should have a 'files' array
        data = response.json()
        if not isinstance(data, dict) or "files" not in data:
            # If the response doesn't have the expected structure, return empty list
            return []

        listing = VolumeDirectoryListing.from_dict(data)

        # Return the API model entries directly (they already have datetime objects)
        # Handle case where files might be None or missing
        return listing.files if listing.files else []

    async def make_dir(
        self,
        path: str,
        user_id: Optional[int] = None,
        group_id: Optional[int] = None,
        mode: Optional[int] = None,
        create_parents: Optional[bool] = None,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        Create a directory.

        :param path: Path to the directory to create
        :param user_id: User ID of the created directory
        :param group_id: Group ID of the created directory
        :param mode: Mode of the created directory
        :param create_parents: Create parent directories if they don't exist
        :param opts: Connection options
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        params: dict[str, Union[str, int, bool, None]] = {
            "path": path,
            "userID": user_id,
            "groupID": group_id,
            "mode": mode,
            "create_parents": create_parents,
        }

        response = await api_client.get_async_httpx_client().request(
            method="POST",
            url=f"/volumes/{self._volume_id}/dir",
            params=params,
            timeout=config.get_request_timeout(opts.get("request_timeout")),
        )

        if response.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if response.status_code >= 300:
            api_response = Response(
                status_code=HTTPStatus(response.status_code),
                content=response.content,
                headers=response.headers,
                parsed=None,
            )
            err = handle_api_exception(api_response)
            if err:
                raise err

    async def get_entry_info(
        self, path: str, **opts: Unpack[ApiParams]
    ) -> VolumeEntryStat:
        """
        Get information about a file or directory.

        :param path: Path to the file or directory
        :param opts: Connection options

        :return: Information about the entry
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        res = await get_volumes_volume_id_stat.asyncio_detailed(
            volume_id=self._volume_id,
            path=path,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        # Return the API model entry directly (it already has datetime objects)
        return res.parsed

    @overload
    async def read_file(
        self,
        path: str,
        format: Literal["text"] = "text",
        **opts: Unpack[ApiParams],
    ) -> str: ...

    @overload
    async def read_file(
        self,
        path: str,
        format: Literal["bytes"],
        **opts: Unpack[ApiParams],
    ) -> bytes: ...

    @overload
    async def read_file(
        self,
        path: str,
        format: Literal["stream"],
        **opts: Unpack[ApiParams],
    ) -> AsyncIterator[bytes]: ...

    async def read_file(
        self,
        path: str,
        format: Literal["text", "bytes", "stream"] = "text",
        **opts: Unpack[ApiParams],
    ) -> Union[str, bytes, AsyncIterator[bytes]]:
        """
        Read file content.

        You can pass `text`, `bytes`, or `stream` to `format` to change the return type.

        :param path: Path to the file
        :param format: Format of the file content—`text` by default
        :param opts: Connection options

        :return: File content as string, bytes, or async iterator of bytes
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        params = {"path": path}
        response = await api_client.get_async_httpx_client().request(
            method="GET",
            url=f"/volumes/{self._volume_id}/file",
            params=params,
            timeout=config.get_request_timeout(opts.get("request_timeout")),
        )

        if response.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if response.status_code >= 300:
            api_response = Response(
                status_code=HTTPStatus(response.status_code),
                content=response.content,
                headers=response.headers,
                parsed=None,
            )
            err = handle_api_exception(api_response)
            if err:
                raise err

        if format == "bytes":
            return response.content
        elif format == "stream":
            return response.aiter_bytes()
        else:  # format == "text"
            # When the file is empty, response.text might be empty. This is a workaround to return an empty string.
            if response.headers.get("content-length") == "0":
                return ""
            return response.text

    async def write_file(
        self,
        path: str,
        data: Union[str, bytes, IO[bytes]],
        user_id: Optional[int] = None,
        group_id: Optional[int] = None,
        mode: Optional[int] = None,
        force: Optional[bool] = None,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        Write content to a file.

        Writing to a file that doesn't exist creates the file.
        Writing to a file that already exists overwrites the file.

        :param path: Path to the file
        :param data: Data to write to the file. Data can be a string, bytes, or IO.
        :param user_id: User ID of the created file
        :param group_id: Group ID of the created file
        :param mode: Mode of the created file
        :param force: Force overwrite of an existing file
        :param opts: Connection options
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        # Convert data to bytes
        if isinstance(data, str):
            data_bytes = data.encode("utf-8")
        elif isinstance(data, bytes):
            data_bytes = data
        elif hasattr(data, "read"):
            content = data.read()
            if isinstance(content, bytes):
                data_bytes = content
            else:
                data_bytes = content.encode("utf-8")
        else:
            raise ValueError(f"Unsupported data type: {type(data)}")

        params: dict[str, Union[str, int, bool, None]] = {
            "path": path,
            "userID": user_id,
            "groupID": group_id,
            "mode": mode,
            "force": force,
        }

        response = await api_client.get_async_httpx_client().request(
            method="POST",
            url=f"/volumes/{self._volume_id}/file",
            params=params,
            content=data_bytes,
            headers={"Content-Type": "application/octet-stream"},
            timeout=config.get_request_timeout(opts.get("request_timeout")),
        )

        if response.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if response.status_code >= 300:
            api_response = Response(
                status_code=HTTPStatus(response.status_code),
                content=response.content,
                headers=response.headers,
                parsed=None,
            )
            err = handle_api_exception(api_response)
            if err:
                raise err

    async def remove(
        self,
        path: str,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        Remove a file or directory.

        :param path: Path to the file or directory to remove
        :param opts: Connection options
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        params = {"path": path}
        response = await api_client.get_async_httpx_client().request(
            method="DELETE",
            url=f"/volumes/{self._volume_id}/file",
            params=params,
            timeout=config.get_request_timeout(opts.get("request_timeout")),
        )

        if response.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if response.status_code >= 300:
            api_response = Response(
                status_code=HTTPStatus(response.status_code),
                content=response.content,
                headers=response.headers,
                parsed=None,
            )
            err = handle_api_exception(api_response)
            if err:
                raise err
