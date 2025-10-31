from io import IOBase
from typing import IO, Iterator, List, Literal, Optional, overload, Union

from e2b.sandbox.filesystem.filesystem import WriteEntry

import e2b_connect
import httpcore
import httpx
from packaging.version import Version

from e2b.envd.versions import ENVD_VERSION_RECURSIVE_WATCH, ENVD_DEFAULT_USER
from e2b.exceptions import SandboxException, TemplateException, InvalidArgumentException
from e2b.connection_config import (
    ConnectionConfig,
    Username,
    default_username,
    KEEPALIVE_PING_HEADER,
    KEEPALIVE_PING_INTERVAL_SEC,
)
from e2b.envd.api import ENVD_API_FILES_ROUTE, handle_envd_api_exception
from e2b.envd.filesystem import filesystem_connect, filesystem_pb2
from e2b.envd.rpc import authentication_header, handle_rpc_exception
from e2b.sandbox.filesystem.filesystem import (
    WriteInfo,
    EntryInfo,
    map_file_type,
)
from e2b.sandbox_sync.filesystem.watch_handle import WatchHandle


class Filesystem:
    """
    Module for interacting with the filesystem in the sandbox.
    """

    def __init__(
        self,
        envd_api_url: str,
        envd_version: Version,
        connection_config: ConnectionConfig,
        pool: httpcore.ConnectionPool,
        envd_api: httpx.Client,
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
            pool=pool,
            json=True,
            headers=connection_config.sandbox_headers,
        )

    @overload
    def read(
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
    def read(
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
    def read(
        self,
        path: str,
        format: Literal["stream"],
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> Iterator[bytes]:
        """
        Read file content as a `Iterator[bytes]`.

        :param path: Path to the file
        :param user: Run the operation as this user
        :param format: Format of the file content—`stream`
        :param request_timeout: Timeout for the request in **seconds**

        :return: File content as an `Iterator[bytes]`
        """
        ...

    def read(
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

        r = self._envd_api.get(
            ENVD_API_FILES_ROUTE,
            params=params,
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

        err = handle_envd_api_exception(r)
        if err:
            raise err

        if format == "text":
            return r.text
        elif format == "bytes":
            return bytearray(r.content)
        elif format == "stream":
            return r.iter_bytes()

    def write(
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
        result = self.write_files(
            [WriteEntry(path=path, data=data)],
            user=user,
            request_timeout=request_timeout,
        )

        if len(result) != 1:
            raise SandboxException("Received unexpected response from write operation")

        return result[0]

    def write_files(
        self,
        files: List[WriteEntry],
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
    ) -> List[WriteInfo]:
        """
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

        r = self._envd_api.post(
            ENVD_API_FILES_ROUTE,
            files=httpx_files,
            params=params,
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

        err = handle_envd_api_exception(r)
        if err:
            raise err

        write_files = r.json()

        if not isinstance(write_files, list) or len(write_files) == 0:
            raise SandboxException("Expected to receive information about written file")

        return [WriteInfo(**file) for file in write_files]

    def list(
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
            res = self._rpc.list_dir(
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

    def exists(
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
            self._rpc.stat(
                filesystem_pb2.StatRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, user),
            )
            return True

        except Exception as e:
            if isinstance(e, e2b_connect.ConnectException):
                if e.status == e2b_connect.Code.not_found:
                    return False
            raise handle_rpc_exception(e)

    def get_info(
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
            r = self._rpc.stat(
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
                # Optional, we can't directly access symlink_target otherwise if will be "" instead of None
                symlink_target=(
                    r.entry.symlink_target
                    if r.entry.HasField("symlink_target")
                    else None
                ),
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    def remove(
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
            self._rpc.remove(
                filesystem_pb2.RemoveRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, user),
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    def rename(
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
            r = self._rpc.move(
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

    def make_dir(
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
            self._rpc.make_dir(
                filesystem_pb2.MakeDirRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, user),
            )

            return True
        except Exception as e:
            if isinstance(e, e2b_connect.ConnectException):
                if e.status == e2b_connect.Code.already_exists:
                    return False
            raise handle_rpc_exception(e)

    def watch_dir(
        self,
        path: str,
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        recursive: bool = False,
    ) -> WatchHandle:
        """
        Watch directory for filesystem events.

        :param path: Path to a directory to watch
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**
        :param recursive: Watch directory recursively

        :return: `WatchHandle` object for stopping watching directory
        """
        if recursive and self._envd_version < ENVD_VERSION_RECURSIVE_WATCH:
            raise TemplateException(
                "You need to update the template to use recursive watching. "
                "You can do this by running `e2b template build` in the directory with the template."
            )

        try:
            r = self._rpc.create_watcher(
                filesystem_pb2.CreateWatcherRequest(path=path, recursive=recursive),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers={
                    **authentication_header(self._envd_version, user),
                    KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
                },
            )
        except Exception as e:
            raise handle_rpc_exception(e)

        return WatchHandle(self._rpc, r.watcher_id)
