import httpcore
import httpx
from io import IOBase
from packaging.version import Version
from typing import AsyncIterator, IO, List, Literal, Optional, overload, Union
from e2b.sandbox.filesystem.filesystem import WriteEntry
import e2b_connect as connect
from e2b.connection_config import (
    ConnectionConfig,
    Username,
    default_username,
    KEEPALIVE_PING_HEADER,
    KEEPALIVE_PING_INTERVAL_SEC,
)
from e2b.envd.api import ENVD_API_FILES_ROUTE, ahandle_envd_api_exception
from e2b.envd.filesystem import filesystem_connect, filesystem_pb2
from e2b.envd.rpc import authentication_header, handle_rpc_exception
from e2b.envd.versions import ENVD_VERSION_RECURSIVE_WATCH, ENVD_DEFAULT_USER
from e2b.exceptions import SandboxException, TemplateException, InvalidArgumentException
from e2b.sandbox.filesystem.filesystem import (
    WriteInfo,
    EntryInfo,
    map_file_type,
)
from e2b.sandbox.filesystem.watch_handle import FilesystemEvent
from e2b.sandbox_async.filesystem.watch_handle import AsyncWatchHandle
from e2b.sandbox_async.utils import OutputHandler


class Filesystem:
    """
    Module for interacting with the filesystem in the sandbox.
    """

    def __init__(
        self,
        envd_api_url: str,
        envd_version: Version,
        connection_config: ConnectionConfig,
        pool: httpcore.AsyncConnectionPool,
        envd_api: httpx.AsyncClient,
    ) -> None:
        self._envd_api_url = envd_api_url
        self._envd_version = envd_version
        self._connection_config = connection_config
        self._pool = pool
        self._envd_api = envd_api

        self._rpc = filesystem_connect.FilesystemClient(
            envd_api_url,
            # TODO: Fix and enable compression again — the headers compression is not solved for streaming.
            # compressor=e2b_connect.GzipCompressor,
            async_pool=pool,
            json=True,
            headers=connection_config.sandbox_headers,
        )

    @overload
    async def read(
        self,
        path: str,
        format: Literal["text"] = "text",
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> str:
        """
        Read file content as a `str`.

        :param path: Path to the file
        :param user: Run the operation as this user
        :param format: Format of the file content—`text` by default
        :param request_timeout: Timeout for the request in **seconds**

        :return: File content as a `str`
        """
        ...

    @overload
    async def read(
        self,
        path: str,
        format: Literal["bytes"],
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> bytearray:
        """
        Read file content as a `bytearray`.

        :param path: Path to the file
        :param user: Run the operation as this user
        :param format: Format of the file content—`bytes`
        :param request_timeout: Timeout for the request in **seconds**

        :return: File content as a `bytearray`
        """
        ...

    @overload
    async def read(
        self,
        path: str,
        format: Literal["stream"],
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> AsyncIterator[bytes]:
        """
        Read file content as a `AsyncIterator[bytes]`.

        :param path: Path to the file
        :param user: Run the operation as this user
        :param format: Format of the file content—`stream`
        :param request_timeout: Timeout for the request in **seconds**

        :return: File content as an `AsyncIterator[bytes]`
        """
        ...

    async def read(
        self,
        path: str,
        format: Literal["text", "bytes", "stream"] = "text",
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ):
        username = user
        if username is None and self._envd_version < ENVD_DEFAULT_USER:
            username = default_username

        params = {"path": path}
        if username:
            params["username"] = username

        r = await self._envd_api.get(
            ENVD_API_FILES_ROUTE,
            params=params,
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

        err = await ahandle_envd_api_exception(r)
        if err:
            raise err

        if format == "text":
            return r.text
        elif format == "bytes":
            return bytearray(r.content)
        elif format == "stream":
            return r.aiter_bytes()

    async def write(
        self,
        path: str,
        data: Union[str, bytes, IO],
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> WriteInfo:
        """
        Write content to a file on the path.
        Writing to a file that doesn't exist creates the file.
        Writing to a file that already exists overwrites the file.
        Writing to a file at path that doesn't exist creates the necessary directories.

        :param path: Path to the file
        :param data: Data to write to the file, can be a `str`, `bytes`, or `IO`.
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**

        :return: Information about the written file
        """
        result = await self.write_files(
            [WriteEntry(path=path, data=data)], user, request_timeout
        )

        if len(result) != 1:
            raise SandboxException("Received unexpected response from write operation")

        return result[0]

    async def write_files(
        self,
        files: List[WriteEntry],
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> List[WriteInfo]:
        """
        Writes multiple files.

        Writes a list of files to the filesystem.
        When writing to a file that doesn't exist, the file will get created.
        When writing to a file that already exists, the file will get overwritten.
        When writing to a file that's in a directory that doesn't exist, you'll get an error.

        :param files: list of files to write as `WriteEntry` objects, each containing `path` and `data`
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request
        :return: Information about the written files
        """
        username = user
        if username is None and self._envd_version < ENVD_DEFAULT_USER:
            username = default_username

        params = {}
        if username:
            params["username"] = username
        if len(files) == 1:
            params["path"] = files[0]["path"]

        # Prepare the files for the multipart/form-data request
        httpx_files = []
        for file in files:
            file_path, file_data = file["path"], file["data"]
            if isinstance(file_data, str) or isinstance(file_data, bytes):
                httpx_files.append(("file", (file_path, file_data)))
            elif isinstance(file_data, IOBase):
                httpx_files.append(("file", (file_path, file_data.read())))
            else:
                raise InvalidArgumentException(
                    f"Unsupported data type for file {file_path}"
                )

        # Allow passing empty list of files
        if len(httpx_files) == 0:
            return []

        r = await self._envd_api.post(
            ENVD_API_FILES_ROUTE,
            files=httpx_files,
            params=params,
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

        err = await ahandle_envd_api_exception(r)
        if err:
            raise err

        write_files = r.json()

        if not isinstance(write_files, list) or len(write_files) == 0:
            raise SandboxException("Expected to receive information about written file")

        return [WriteInfo(**file) for file in write_files]

    async def list(
        self,
        path: str,
        depth: Optional[int] = 1,
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> List[EntryInfo]:
        """
        List entries in a directory.

        :param path: Path to the directory
        :param depth: Depth of the directory to list
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**

        :return: List of entries in the directory
        """
        if depth is not None and depth < 1:
            raise InvalidArgumentException("depth should be at least 1")

        try:
            res = await self._rpc.alist_dir(
                filesystem_pb2.ListDirRequest(path=path, depth=depth),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, user),
            )

            entries: List[EntryInfo] = []
            for entry in res.entries:
                event_type = map_file_type(entry.type)

                if event_type:
                    entries.append(
                        EntryInfo(
                            name=entry.name,
                            type=event_type,
                            path=entry.path,
                            size=entry.size,
                            mode=entry.mode,
                            permissions=entry.permissions,
                            owner=entry.owner,
                            group=entry.group,
                            modified_time=entry.modified_time.ToDatetime(),
                            # Optional, we can't directly access symlink_target otherwise if will be "" instead of None
                            symlink_target=(
                                entry.symlink_target
                                if entry.HasField("symlink_target")
                                else None
                            ),
                        )
                    )

            return entries
        except Exception as e:
            raise handle_rpc_exception(e)

    async def exists(
        self,
        path: str,
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> bool:
        """
        Check if a file or a directory exists.

        :param path: Path to a file or a directory
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**

        :return: `True` if the file or directory exists, `False` otherwise
        """
        try:
            await self._rpc.astat(
                filesystem_pb2.StatRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, user),
            )

            return True

        except Exception as e:
            if isinstance(e, connect.ConnectException):
                if e.status == connect.Code.not_found:
                    return False
            raise handle_rpc_exception(e)

    async def get_info(
        self,
        path: str,
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> EntryInfo:
        """
        Get information about a file or directory.

        :param path: Path to a file or a directory
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**

        :return: Information about the file or directory like name, type, and path
        """
        try:
            r = await self._rpc.astat(
                filesystem_pb2.StatRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, user),
            )

            return EntryInfo(
                name=r.entry.name,
                type=map_file_type(r.entry.type),
                path=r.entry.path,
                size=r.entry.size,
                mode=r.entry.mode,
                permissions=r.entry.permissions,
                owner=r.entry.owner,
                group=r.entry.group,
                modified_time=r.entry.modified_time.ToDatetime(),
                symlink_target=(
                    r.entry.symlink_target
                    if r.entry.HasField("symlink_target")
                    else None
                ),
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    async def remove(
        self,
        path: str,
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> None:
        """
        Remove a file or a directory.

        :param path: Path to a file or a directory
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**
        """
        try:
            await self._rpc.aremove(
                filesystem_pb2.RemoveRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, user),
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    async def rename(
        self,
        old_path: str,
        new_path: str,
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> EntryInfo:
        """
        Rename a file or directory.

        :param old_path: Path to the file or directory to rename
        :param new_path: New path to the file or directory
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**

        :return: Information about the renamed file or directory
        """
        try:
            r = await self._rpc.amove(
                filesystem_pb2.MoveRequest(
                    source=old_path,
                    destination=new_path,
                ),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, user),
            )

            return EntryInfo(
                name=r.entry.name,
                type=map_file_type(r.entry.type),
                path=r.entry.path,
                size=r.entry.size,
                mode=r.entry.mode,
                permissions=r.entry.permissions,
                owner=r.entry.owner,
                group=r.entry.group,
                modified_time=r.entry.modified_time.ToDatetime(),
                # Optional, we can't directly access symlink_target otherwise if will be "" instead of None
                symlink_target=(
                    r.entry.symlink_target
                    if r.entry.HasField("symlink_target")
                    else None
                ),
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    async def make_dir(
        self,
        path: str,
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> bool:
        """
        Create a new directory and all directories along the way if needed on the specified path.

        :param path: Path to a new directory. For example '/dirA/dirB' when creating 'dirB'.
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**

        :return: `True` if the directory was created, `False` if the directory already exists
        """
        try:
            await self._rpc.amake_dir(
                filesystem_pb2.MakeDirRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, user),
            )

            return True
        except Exception as e:
            if isinstance(e, connect.ConnectException):
                if e.status == connect.Code.already_exists:
                    return False
            raise handle_rpc_exception(e)

    async def watch_dir(
        self,
        path: str,
        on_event: OutputHandler[FilesystemEvent],
        on_exit: Optional[OutputHandler[Exception]] = None,
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        timeout: Optional[float] = 60,
        recursive: bool = False,
    ) -> AsyncWatchHandle:
        """
        Watch directory for filesystem events.

        :param path: Path to a directory to watch
        :param on_event: Callback to call on each event in the directory
        :param on_exit: Callback to call when the watching ends
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**
        :param timeout: Timeout for the watch operation in **seconds**. Using `0` will not limit the watch time
        :param recursive: Watch directory recursively

        :return: `AsyncWatchHandle` object for stopping watching directory
        """
        if recursive and self._envd_version < ENVD_VERSION_RECURSIVE_WATCH:
            raise TemplateException(
                "You need to update the template to use recursive watching. "
                "You can do this by running `e2b template build` in the directory with the template."
            )

        events = self._rpc.awatch_dir(
            filesystem_pb2.WatchDirRequest(path=path, recursive=recursive),
            request_timeout=self._connection_config.get_request_timeout(
                request_timeout
            ),
            timeout=timeout,
            headers={
                **authentication_header(self._envd_version, user),
                KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
            },
        )

        try:
            start_event = await events.__anext__()

            if not start_event.HasField("start"):
                raise SandboxException(
                    f"Failed to start watch: expected start event, got {start_event}",
                )

            return AsyncWatchHandle(events=events, on_event=on_event, on_exit=on_exit)
        except Exception as e:
            raise handle_rpc_exception(e)
