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
    get_volumes_volume_id_dir,
    patch_volumes_volume_id_file,
)
from e2b.api.client.models import (
    NewVolume as NewVolumeModel,
    Error,
    PatchVolumesVolumeIDFileBody,
    VolumeEntryStat as VolumeEntryStatApi,
)
from e2b.api.client.types import Response, UNSET
from e2b.api.client_async import get_api_client
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import NotFoundException
from e2b.volume.types import (
    VolumeInfo,
    VolumeEntryStat,
)


def _convert_volume_entry_stat(api_stat: VolumeEntryStatApi) -> VolumeEntryStat:
    """Convert API VolumeEntryStat to SDK VolumeEntryStat."""
    from e2b.api.client.types import UNSET

    target: Optional[str] = None
    if api_stat.target is not UNSET and api_stat.target is not None:
        target = str(api_stat.target)

    return VolumeEntryStat(
        name=api_stat.name,
        type=api_stat.type_,
        path=api_stat.path,
        size=api_stat.size,
        mode=api_stat.mode,
        uid=api_stat.uid,
        gid=api_stat.gid,
        mtime=api_stat.mtime,
        ctime=api_stat.ctime,
        target=target,
    )


class AsyncVolume:
    """E2B Volume for persistent storage that can be mounted to sandboxes (async)."""

    def __init__(self, volume_id: str, name: str):
        self._volume_id = volume_id
        self._name = name

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

        vol = cls(volume_id=res.parsed.volume_id, name=res.parsed.name)
        return vol

    @classmethod
    async def connect(cls, volume_id: str, **opts: Unpack[ApiParams]) -> "AsyncVolume":
        """
        Connect to an existing volume by ID.

        :param volume_id: Volume ID

        :return: An AsyncVolume instance for the existing volume
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

        vol = cls(volume_id=res.parsed.volume_id, name=res.parsed.name)
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

    async def list(  # noqa: F811
        self, path: str, depth: Optional[int] = None, **opts: Unpack[ApiParams]
    ) -> List[VolumeEntryStat]:
        """
        List directory contents.

        :param path: Path to the directory
        :param depth: Number of layers deep to recurse into the directory
        :param opts: Connection options

        :return: List of items (files and directories) in the directory
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        res = await get_volumes_volume_id_dir.asyncio_detailed(
            volume_id=self._volume_id,
            path=path,
            depth=depth if depth is not None else UNSET,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            return []

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        # VolumeDirectoryListing is a list according to the spec
        if isinstance(res.parsed, list):
            return [_convert_volume_entry_stat(entry) for entry in res.parsed]
        return []

    async def make_dir(
        self,
        path: str,
        uid: Optional[int] = None,
        gid: Optional[int] = None,
        mode: Optional[int] = None,
        create_parents: Optional[bool] = None,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        Create a directory.

        :param path: Path to the directory to create
        :param uid: User ID of the created directory
        :param gid: Group ID of the created directory
        :param mode: Mode of the created directory
        :param create_parents: Create parent directories if they don't exist
        :param opts: Connection options
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        params: dict[str, Union[str, int, bool, None]] = {
            "path": path,
            "uid": uid,
            "gid": gid,
            "mode": mode,
            "createParents": create_parents,
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

        return _convert_volume_entry_stat(res.parsed)

    async def update_metadata(
        self,
        path: str,
        uid: Optional[int] = None,
        gid: Optional[int] = None,
        mode: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> VolumeEntryStat:
        """
        Update file or directory metadata.

        :param path: Path to the file or directory
        :param uid: User ID of the file or directory
        :param gid: Group ID of the file or directory
        :param mode: Mode of the file or directory
        :param opts: Connection options

        :return: Updated entry information
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        body = PatchVolumesVolumeIDFileBody(
            uid=uid if uid is not None else UNSET,
            gid=gid if gid is not None else UNSET,
            mode=mode if mode is not None else UNSET,
        )

        res = await patch_volumes_volume_id_file.asyncio_detailed(
            volume_id=self._volume_id,
            path=path,
            body=body,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        return _convert_volume_entry_stat(res.parsed)

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
        uid: Optional[int] = None,
        gid: Optional[int] = None,
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
        :param uid: User ID of the created file
        :param gid: Group ID of the created file
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
            "uid": uid,
            "gid": gid,
            "mode": mode,
            "force": force,
        }

        response = await api_client.get_async_httpx_client().request(
            method="PUT",
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
        recursive: Optional[bool] = None,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        Remove a file or directory.

        :param path: Path to the file or directory to remove
        :param recursive: Delete all files and directories recursively (for directories only)
        :param opts: Connection options
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        # Determine if it's a directory by checking entry info
        is_directory = False
        try:
            entry_info = await self.get_entry_info(path, **opts)
            is_directory = entry_info.type.value == "directory"
        except Exception:
            # If we can't get entry info, assume it's a file and try the file endpoint
            pass

        if is_directory:
            params: dict[str, Union[str, bool, None]] = {
                "path": path,
                "recursive": recursive,
            }
            url = f"/volumes/{self._volume_id}/dir"
        else:
            params = {"path": path}
            url = f"/volumes/{self._volume_id}/file"

        response = await api_client.get_async_httpx_client().request(
            method="DELETE",
            url=url,
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
