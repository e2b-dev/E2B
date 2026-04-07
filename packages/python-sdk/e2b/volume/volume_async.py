from typing import AsyncIterator, IO, List, Literal, Optional, Union, cast, overload
from http import HTTPStatus

import httpx

from typing_extensions import Unpack

from e2b.api import handle_api_exception
from e2b.api.client.api.volumes import (
    post_volumes,
    get_volumes,
    get_volumes_volume_id,
    delete_volumes_volume_id,
)
from e2b.api.client.models import (
    NewVolume as NewVolumeModel,
    Error,
)
from e2b.api.client.types import Response
from e2b.api.client_async import get_api_client as get_core_api_client
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import NotFoundException, VolumeException
from e2b.volume.client.api.volumes import (
    get_volumecontent_volume_id_path as get_path,
    get_volumecontent_volume_id_dir as get_dir,
    post_volumecontent_volume_id_dir as post_dir,
    delete_volumecontent_volume_id_path as delete_path,
    patch_volumecontent_volume_id_path as patch_path,
    put_volumecontent_volume_id_file as put_file,
)
from e2b.volume.client.models import (
    Error as VolumeError,
    PatchVolumecontentVolumeIDPathBody as PatchPathBody,
    VolumeEntryStat as VolumeEntryStatApi,
)
from e2b.volume.client.types import File as FilePayload, UNSET
from e2b.volume.client_async import get_api_client as get_volume_api_client
from e2b.volume.connection_config import (
    VolumeApiParams,
    VolumeConnectionConfig,
    FILE_TIMEOUT,
)
from e2b.volume.types import (
    VolumeAndToken,
    VolumeInfo,
    VolumeEntryStat,
)
from e2b.volume.utils import DualMethod, convert_volume_entry_stat


class AsyncVolume:
    """E2B Volume for persistent storage that can be mounted to sandboxes (async)."""

    def __init__(
        self,
        volume_id: str,
        name: str,
        token: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
    ):
        self._volume_id = volume_id
        self._name = name
        self._token = token
        self._domain = domain
        self._debug = debug

    @property
    def volume_id(self) -> str:
        return self._volume_id

    @property
    def name(self) -> str:
        return self._name

    @property
    def token(self) -> Optional[str]:
        return self._token

    def _get_volume_config(
        self, **opts: Unpack[VolumeApiParams]
    ) -> VolumeConnectionConfig:
        return VolumeConnectionConfig(
            domain=opts.get("domain") or self._domain,
            debug=opts.get("debug") if opts.get("debug") is not None else self._debug,
            token=opts.get("token") or self._token,
            api_url=opts.get("api_url"),
            request_timeout=opts.get("request_timeout"),
            headers=opts.get("headers"),
            proxy=opts.get("proxy"),
        )

    @classmethod
    async def create(cls, name: str, **opts: Unpack[ApiParams]) -> "AsyncVolume":
        """
        Create a new volume.

        :param name: Name of the volume

        :return: An AsyncVolume instance for the new volume
        """
        config = ConnectionConfig(**opts)

        api_client = get_core_api_client(config)
        res = await post_volumes.asyncio_detailed(
            body=NewVolumeModel(name=name),
            client=api_client,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        vol = cls(
            volume_id=res.parsed.volume_id,
            name=res.parsed.name,
            token=res.parsed.token,
            domain=config.domain,
            debug=config.debug,
        )
        return vol

    @classmethod
    async def connect(cls, volume_id: str, **opts: Unpack[ApiParams]) -> "AsyncVolume":
        """
        Connect to an existing volume by ID.

        :param volume_id: Volume ID

        :return: An AsyncVolume instance for the existing volume
        """
        info = await cls.get_info(volume_id, **opts)
        config = ConnectionConfig(**opts)
        return cls(
            volume_id=volume_id,
            name=info.name,
            token=info.token,
            domain=config.domain,
            debug=config.debug,
        )

    @staticmethod
    async def _class_get_info(
        volume_id: str, **opts: Unpack[ApiParams]
    ) -> VolumeAndToken:
        """
        Get information about a volume.

        :param volume_id: Volume ID

        :return: Volume info
        """
        config = ConnectionConfig(**opts)

        api_client = get_core_api_client(config)
        res = await get_volumes_volume_id.asyncio_detailed(
            volume_id,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Volume {volume_id} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        return VolumeAndToken(
            volume_id=res.parsed.volume_id,
            name=res.parsed.name,
            token=res.parsed.token,
        )

    @staticmethod
    async def _class_list(**opts: Unpack[ApiParams]) -> List[VolumeInfo]:
        """
        List all volumes.

        :return: List of volumes
        """
        config = ConnectionConfig(**opts)

        api_client = get_core_api_client(config)
        res = await get_volumes.asyncio_detailed(
            client=api_client,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

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

        api_client = get_core_api_client(config)
        res = await delete_volumes_volume_id.asyncio_detailed(
            volume_id,
            client=api_client,
        )

        if res.status_code == 404:
            return False

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

        return True

    async def _instance_list(
        self, path: str, depth: Optional[int] = None, **opts: Unpack[VolumeApiParams]
    ) -> List[VolumeEntryStat]:
        """
        List directory contents.

        :param path: Path to the directory
        :param depth: Number of layers deep to recurse into the directory
        :param opts: Connection options

        :return: List of items (files and directories) in the directory
        """
        config = self._get_volume_config(**opts)
        api_client = get_volume_api_client(config)

        res = await get_dir.asyncio_detailed(
            self._volume_id,
            path=path,
            depth=depth if depth is not None else UNSET,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            return []

        if isinstance(res.parsed, VolumeError):
            raise Exception(f"{res.parsed.message}: Request failed")

        # VolumeDirectoryListing is a list according to the spec
        if isinstance(res.parsed, list):
            parsed_entries = cast(List[VolumeEntryStatApi], res.parsed)
            return [convert_volume_entry_stat(entry) for entry in parsed_entries]
        return []

    async def make_dir(
        self,
        path: str,
        uid: Optional[int] = None,
        gid: Optional[int] = None,
        mode: Optional[int] = None,
        force: Optional[bool] = None,
        **opts: Unpack[VolumeApiParams],
    ) -> VolumeEntryStat:
        """
        Create a directory.

        :param path: Path to the directory to create
        :param uid: User ID of the created directory
        :param gid: Group ID of the created directory
        :param mode: Mode of the created directory
        :param force: Create parent directories if they don't exist
        :param opts: Connection options

        :return: Information about the created directory
        """
        config = self._get_volume_config(**opts)
        api_client = get_volume_api_client(config)

        res = await post_dir.asyncio_detailed(
            self._volume_id,
            path=path,
            uid=uid if uid is not None else UNSET,
            gid=gid if gid is not None else UNSET,
            mode=mode if mode is not None else UNSET,
            force=force if force is not None else UNSET,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, VolumeError):
            raise Exception(f"{res.parsed.message}: Request failed")

        return convert_volume_entry_stat(res.parsed)

    async def exists(self, path: str, **opts: Unpack[VolumeApiParams]) -> bool:
        """
        Check whether a file or directory exists.

        Uses get_info under the hood. Returns True if the path exists,
        False if it does not (404). Other errors are re-raised.

        :param path: Path to the file or directory
        :param opts: Connection options

        :return: True if the path exists, False otherwise
        """
        try:
            await self.get_info(path, **opts)
            return True
        except NotFoundException:
            return False

    async def _instance_get_info(
        self, path: str, **opts: Unpack[VolumeApiParams]
    ) -> VolumeEntryStat:
        """
        Get information about a file or directory.

        :param path: Path to the file or directory
        :param opts: Connection options

        :return: Information about the entry
        """
        config = self._get_volume_config(**opts)
        api_client = get_volume_api_client(config)

        res = await get_path.asyncio_detailed(
            self._volume_id,
            path=path,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, VolumeError):
            raise Exception(f"{res.parsed.message}: Request failed")

        return convert_volume_entry_stat(cast(VolumeEntryStatApi, res.parsed))

    get_info = DualMethod(_class_get_info.__func__, _instance_get_info)
    list = DualMethod(_class_list.__func__, _instance_list)

    async def update_metadata(
        self,
        path: str,
        uid: Optional[int] = None,
        gid: Optional[int] = None,
        mode: Optional[int] = None,
        **opts: Unpack[VolumeApiParams],
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
        config = self._get_volume_config(**opts)
        api_client = get_volume_api_client(config)

        body = PatchPathBody(
            uid=uid if uid is not None else UNSET,
            gid=gid if gid is not None else UNSET,
            mode=mode if mode is not None else UNSET,
        )

        res = await patch_path.asyncio_detailed(
            self._volume_id,
            path=path,
            body=body,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        return convert_volume_entry_stat(cast(VolumeEntryStatApi, res.parsed))

    @overload
    async def read_file(
        self,
        path: str,
        format: Literal["text"] = "text",
        **opts: Unpack[VolumeApiParams],
    ) -> str: ...

    @overload
    async def read_file(
        self,
        path: str,
        format: Literal["bytes"],
        **opts: Unpack[VolumeApiParams],
    ) -> bytes: ...

    @overload
    async def read_file(
        self,
        path: str,
        format: Literal["stream"],
        **opts: Unpack[VolumeApiParams],
    ) -> AsyncIterator[bytes]: ...

    async def read_file(
        self,
        path: str,
        format: Literal["text", "bytes", "stream"] = "text",
        **opts: Unpack[VolumeApiParams],
    ) -> Union[str, bytes, AsyncIterator[bytes]]:
        """
        Read file content.

        You can pass `text`, `bytes`, or `stream` to `format` to change the return type.

        :param path: Path to the file
        :param format: Format of the file content—`text` by default
        :param opts: Connection options

        :return: File content as string, bytes, or async iterator of bytes
        """
        config = self._get_volume_config(**opts)
        api_client = get_volume_api_client(config)

        params = {"path": path}
        timeout = VolumeConnectionConfig._get_request_timeout(
            FILE_TIMEOUT, opts.get("request_timeout")
        )

        if format == "stream":

            async def stream_file() -> AsyncIterator[bytes]:
                async with api_client.get_async_httpx_client().stream(
                    method="GET",
                    url=f"/volumecontent/{self._volume_id}/file",
                    params=params,
                    timeout=timeout,
                ) as response:
                    if response.status_code == 404:
                        raise NotFoundException(f"Path {path} not found")

                    if response.status_code >= 300:
                        api_response = Response(
                            status_code=HTTPStatus(response.status_code),
                            content=await response.aread(),
                            headers=response.headers,
                            parsed=None,
                        )
                        raise handle_api_exception(api_response, VolumeException)

                    async for chunk in response.aiter_bytes():
                        yield chunk

            return stream_file()

        response = await api_client.get_async_httpx_client().request(
            method="GET",
            url=f"/volumecontent/{self._volume_id}/file",
            params=params,
            timeout=timeout,
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
            raise handle_api_exception(api_response, VolumeException)

        if format == "bytes":
            return response.content
        else:
            return response.text

    async def write_file(
        self,
        path: str,
        data: Union[str, bytes, IO[bytes]],
        uid: Optional[int] = None,
        gid: Optional[int] = None,
        mode: Optional[int] = None,
        force: Optional[bool] = None,
        **opts: Unpack[VolumeApiParams],
    ) -> VolumeEntryStat:
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

        :return: Information about the written file
        """
        config = self._get_volume_config(**opts)
        upload_timeout = VolumeConnectionConfig._get_request_timeout(
            FILE_TIMEOUT, opts.get("request_timeout")
        )
        api_client = get_volume_api_client(config)
        if upload_timeout is not None:
            api_client = api_client.with_timeout(httpx.Timeout(upload_timeout))

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

        res = await put_file.asyncio_detailed(
            self._volume_id,
            body=FilePayload(payload=data_bytes),  # type: ignore[arg-type]  # Pass bytes directly for async httpx compatibility
            path=path,
            uid=uid if uid is not None else UNSET,
            gid=gid if gid is not None else UNSET,
            mode=mode if mode is not None else UNSET,
            force=force if force is not None else UNSET,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, VolumeError):
            raise Exception(f"{res.parsed.message}: Request failed")

        return convert_volume_entry_stat(cast(VolumeEntryStatApi, res.parsed))

    async def remove(
        self,
        path: str,
        **opts: Unpack[VolumeApiParams],
    ) -> None:
        """
        Remove a file or directory.

        :param path: Path to the file or directory to remove
        :param opts: Connection options
        """
        config = self._get_volume_config(**opts)
        api_client = get_volume_api_client(config)

        res = await delete_path.asyncio_detailed(
            self._volume_id,
            path=path,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)
