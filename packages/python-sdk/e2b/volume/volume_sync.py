from typing import IO, Iterator, List, Literal, Optional, Union, overload
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
    post_volumes_volume_id_dir,
    patch_volumes_volume_id_file,
)
from e2b.api.client.models import (
    NewVolume as NewVolumeModel,
    Error,
    PatchVolumesVolumeIDFileBody,
    VolumeEntryStat as VolumeEntryStatApi,
)
from e2b.api.client.types import Response, UNSET
from e2b.api.client_sync import get_api_client
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import NotFoundException, VolumeException
from e2b.volume.types import (
    VolumeInfo,
    VolumeEntryStat,
)
from e2b.volume.utils import DualMethod, convert_volume_entry_stat


class Volume:
    """E2B Volume for persistent storage that can be mounted to sandboxes."""

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
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        vol = cls(volume_id=res.parsed.volume_id, name=res.parsed.name)
        return vol

    @classmethod
    def connect(cls, volume_id: str, **opts: Unpack[ApiParams]) -> "Volume":
        """
        Connect to an existing volume by ID.

        :param volume_id: Volume ID

        :return: A Volume instance for the existing volume
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
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        vol = cls(volume_id=res.parsed.volume_id, name=res.parsed.name)
        return vol

    @staticmethod
    def _class_get_info(volume_id: str, **opts: Unpack[ApiParams]) -> VolumeInfo:
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
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        return VolumeInfo(volume_id=res.parsed.volume_id, name=res.parsed.name)

    @staticmethod
    def _class_list(**opts: Unpack[ApiParams]) -> List[VolumeInfo]:
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
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            return []

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        return [VolumeInfo(volume_id=v.volume_id, name=v.name) for v in res.parsed]

    @staticmethod
    def destroy(volume_id: str, **opts: Unpack[ApiParams]) -> bool:
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
            return False

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

        return True

    def _instance_list(
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

        res = get_volumes_volume_id_dir.sync_detailed(
            volume_id=self._volume_id,
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

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        # VolumeDirectoryListing is a list according to the spec
        if isinstance(res.parsed, list):
            return [convert_volume_entry_stat(entry) for entry in res.parsed]
        return []

    def make_dir(
        self,
        path: str,
        uid: Optional[int] = None,
        gid: Optional[int] = None,
        mode: Optional[int] = None,
        force: Optional[bool] = None,
        **opts: Unpack[ApiParams],
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
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        res = post_volumes_volume_id_dir.sync_detailed(
            volume_id=self._volume_id,
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

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        return convert_volume_entry_stat(res.parsed)

    def exists(self, path: str, **opts: Unpack[ApiParams]) -> bool:
        """
        Check whether a file or directory exists.

        Uses get_info under the hood. Returns True if the path exists,
        False if it does not (404). Other errors are re-raised.

        :param path: Path to the file or directory
        :param opts: Connection options

        :return: True if the path exists, False otherwise
        """
        try:
            self.get_info(path, **opts)
            return True
        except NotFoundException:
            return False

    def _instance_get_info(
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

        res = get_volumes_volume_id_stat.sync_detailed(
            volume_id=self._volume_id,
            path=path,
            client=api_client,
        )

        if res.status_code == 404:
            raise NotFoundException(f"Path {path} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, VolumeException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise Exception(f"{res.parsed.message}: Request failed")

        return convert_volume_entry_stat(res.parsed)

    get_info = DualMethod(_class_get_info.__func__, _instance_get_info)
    list = DualMethod(_class_list.__func__, _instance_list)

    def update_metadata(
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

        res = patch_volumes_volume_id_file.sync_detailed(
            volume_id=self._volume_id,
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

        return convert_volume_entry_stat(res.parsed)

    @overload
    def read_file(
        self,
        path: str,
        format: Literal["text"] = "text",
        **opts: Unpack[ApiParams],
    ) -> str: ...

    @overload
    def read_file(
        self,
        path: str,
        format: Literal["bytes"],
        **opts: Unpack[ApiParams],
    ) -> bytes: ...

    @overload
    def read_file(
        self,
        path: str,
        format: Literal["stream"],
        **opts: Unpack[ApiParams],
    ) -> Iterator[bytes]: ...

    def read_file(
        self,
        path: str,
        format: Literal["text", "bytes", "stream"] = "text",
        **opts: Unpack[ApiParams],
    ) -> Union[str, bytes, Iterator[bytes]]:
        """
        Read file content.

        You can pass `text`, `bytes`, or `stream` to `format` to change the return type.

        :param path: Path to the file
        :param format: Format of the file content—`text` by default
        :param opts: Connection options

        :return: File content as string, bytes, or iterator of bytes
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

        params = {"path": path}
        response = api_client.get_httpx_client().request(
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
            err = handle_api_exception(api_response, VolumeException)
            if err:
                raise err

        if format == "bytes":
            return response.content
        elif format == "stream":
            return response.iter_bytes()
        else:
            return response.text

    def write_file(
        self,
        path: str,
        data: Union[str, bytes, IO[bytes]],
        uid: Optional[int] = None,
        gid: Optional[int] = None,
        mode: Optional[int] = None,
        force: Optional[bool] = None,
        **opts: Unpack[ApiParams],
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
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)

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

        params: dict[str, Union[str, int, bool]] = {"path": path}
        if uid is not None:
            params["uid"] = uid
        if gid is not None:
            params["gid"] = gid
        if mode is not None:
            params["mode"] = mode
        if force is not None:
            params["force"] = force

        response = api_client.get_httpx_client().request(
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
            err = handle_api_exception(api_response, VolumeException)
            if err:
                raise err

        parsed = VolumeEntryStatApi.from_dict(response.json())
        return convert_volume_entry_stat(parsed)

    def remove(
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

        is_directory = False
        try:
            entry_info = self.get_info(path, **opts)
            is_directory = entry_info.type.value == "directory"
        except NotFoundException:
            pass

        if is_directory:
            params: dict[str, Union[str, bool]] = {"path": path}
            if recursive is not None:
                params["recursive"] = recursive
            url = f"/volumes/{self._volume_id}/dir"
        else:
            params = {"path": path}
            url = f"/volumes/{self._volume_id}/file"

        response = api_client.get_httpx_client().request(
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
            err = handle_api_exception(api_response, VolumeException)
            if err:
                raise err
