import threading
from typing import IO, Dict, Iterator, List, Literal, Optional, Union, overload

import httpcore
import httpx
from packaging.version import Version

import e2b_connect
from e2b.api.client_sync import get_envd_transport
from e2b.connection_config import (
    KEEPALIVE_PING_HEADER,
    KEEPALIVE_PING_INTERVAL_SEC,
    ConnectionConfig,
    Username,
    default_username,
)
from e2b_connect.client import Code

from e2b.envd.api import ENVD_API_FILES_ROUTE, handle_envd_api_exception
from e2b.envd.filesystem import filesystem_connect, filesystem_pb2
from e2b.envd.rpc import authentication_header, handle_rpc_exception
from e2b.envd.versions import (
    ENVD_DEFAULT_USER,
    ENVD_FILE_METADATA,
    ENVD_OCTET_STREAM_UPLOAD,
    ENVD_VERSION_FS_EVENT_ENTRY_INFO,
    ENVD_VERSION_RECURSIVE_WATCH,
)
from e2b.exceptions import (
    FileNotFoundException,
    InvalidArgumentException,
    SandboxException,
    TemplateException,
)
from e2b.sandbox.filesystem.filesystem import (
    EntryInfo,
    WriteEntry,
    WriteInfo,
    _to_httpx_file,
    map_entry_info,
    map_file_type,
    metadata_to_headers,
    to_upload_body,
    validate_metadata,
)
from e2b.sandbox_sync.filesystem.watch_handle import WatchHandle


_FILESYSTEM_RPC_ERROR_MAP = {
    Code.not_found: FileNotFoundException,
}

_FILESYSTEM_HTTP_ERROR_MAP = {
    404: FileNotFoundException,
}


def _handle_filesystem_rpc_exception(e: Exception) -> Exception:
    return handle_rpc_exception(e, _FILESYSTEM_RPC_ERROR_MAP)


def _handle_filesystem_envd_api_exception(r):
    return handle_envd_api_exception(r, _FILESYSTEM_HTTP_ERROR_MAP)


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
        self._thread_local = threading.local()
        self._thread_local.envd_api = envd_api

        self._thread_local.rpc = filesystem_connect.FilesystemClient(
            envd_api_url,
            # TODO: Fix and enable compression again — the headers compression is not solved for streaming.
            # compressor=e2b_connect.GzipCompressor,
            pool=pool,
            json=True,
            headers=connection_config.sandbox_headers,
        )

    @property
    def _envd_api(self) -> httpx.Client:
        envd_api = getattr(self._thread_local, "envd_api", None)
        if envd_api is None:
            transport = get_envd_transport(self._connection_config)
            envd_api = httpx.Client(
                base_url=self._envd_api_url,
                transport=transport,
                headers=self._connection_config.sandbox_headers,
            )
            self._thread_local.envd_api = envd_api
        return envd_api

    @property
    def _rpc(self) -> filesystem_connect.FilesystemClient:
        rpc = getattr(self._thread_local, "rpc", None)
        if rpc is None:
            transport = get_envd_transport(self._connection_config)
            rpc = filesystem_connect.FilesystemClient(
                self._envd_api_url,
                # TODO: Fix and enable compression again — the headers compression is not solved for streaming.
                # compressor=e2b_connect.GzipCompressor,
                pool=transport.pool,
                json=True,
                headers=self._connection_config.sandbox_headers,
            )
            self._thread_local.rpc = rpc
        return rpc

    @overload
    def read(
        self,
        path: str,
        format: Literal["text"] = "text",
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        gzip: bool = False,
    ) -> str:
        """
        Read file content as a `str`.

        :param path: Path to the file
        :param user: Run the operation as this user
        :param format: Format of the file content—`text` by default
        :param request_timeout: Timeout for the request in **seconds**
        :param gzip: Use gzip compression for the request

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
        gzip: bool = False,
    ) -> bytearray:
        """
        Read file content as a `bytearray`.

        :param path: Path to the file
        :param user: Run the operation as this user
        :param format: Format of the file content—`bytes`
        :param request_timeout: Timeout for the request in **seconds**
        :param gzip: Use gzip compression for the request

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
        gzip: bool = False,
    ) -> Iterator[bytes]:
        """
        Read file content as a `Iterator[bytes]`.

        :param path: Path to the file
        :param user: Run the operation as this user
        :param format: Format of the file content—`stream`
        :param request_timeout: Timeout for the request in **seconds**
        :param gzip: Use gzip compression for the request

        :return: File content as an `Iterator[bytes]`
        """
        ...

    def read(
        self,
        path: str,
        format: Literal["text", "bytes", "stream"] = "text",
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        gzip: bool = False,
    ):
        username = user
        if username is None and self._envd_version < ENVD_DEFAULT_USER:
            username = default_username

        params = {"path": path}
        if username:
            params["username"] = username

        headers = {}
        if gzip:
            headers["Accept-Encoding"] = "gzip"

        r = self._envd_api.get(
            ENVD_API_FILES_ROUTE,
            params=params,
            headers=headers,
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

        err = _handle_filesystem_envd_api_exception(r)
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
        gzip: bool = False,
        use_octet_stream: bool = False,
        metadata: Optional[Dict[str, str]] = None,
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
        :param gzip: Use gzip compression for the request
        :param use_octet_stream: Upload using `application/octet-stream` instead of `multipart/form-data`. Defaults to `False`. Requires envd 0.5.7 or later — when not supported, the upload falls back to `multipart/form-data`.
        :param metadata: User-defined metadata to persist on the uploaded file as extended attributes. Keys are lowercased by the sandbox; invalid keys or values raise an `InvalidArgumentException`. Requires envd 0.6.2 or later.

        :return: Information about the written file
        """
        result = self.write_files(
            [WriteEntry(path=path, data=data)],
            user=user,
            request_timeout=request_timeout,
            gzip=gzip,
            use_octet_stream=use_octet_stream,
            metadata=metadata,
        )

        if len(result) != 1:
            raise SandboxException("Received unexpected response from write operation")

        return result[0]

    def write_files(
        self,
        files: List[WriteEntry],
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        gzip: bool = False,
        use_octet_stream: bool = False,
        metadata: Optional[Dict[str, str]] = None,
    ) -> List[WriteInfo]:
        """
        Writes multiple files.

        Writes a list of files to the filesystem.
        When writing to a file that doesn't exist, the file will get created.
        When writing to a file that already exists, the file will get overwritten.
        When writing to a file at path that doesn't exist, the necessary directories will be created.

        :param files: list of files to write as `WriteEntry` objects, each containing `path` and `data`
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request
        :param gzip: Use gzip compression for the request
        :param use_octet_stream: Upload using `application/octet-stream` instead of `multipart/form-data`. Defaults to `False`. Requires envd 0.5.7 or later — when not supported, the upload falls back to `multipart/form-data`.
        :param metadata: User-defined metadata to persist on each uploaded file as extended attributes; the same map is applied to every file. Keys are lowercased by the sandbox; invalid keys or values raise an `InvalidArgumentException`. Requires envd 0.6.2 or later.
        :return: Information about the written files
        """
        username = user
        if username is None and self._envd_version < ENVD_DEFAULT_USER:
            username = default_username

        if len(files) == 0:
            return []

        validate_metadata(metadata)

        if metadata and self._envd_version < ENVD_FILE_METADATA:
            raise TemplateException("File metadata requires envd 0.6.2 or later.")

        supports_octet_stream = self._envd_version >= ENVD_OCTET_STREAM_UPLOAD
        use_octet_stream = use_octet_stream and supports_octet_stream

        # Metadata is sent as request-scoped X-Metadata-* headers, so the same
        # metadata is applied to every file in a multi-file upload.
        extra_headers = metadata_to_headers(metadata)

        results: List[WriteInfo] = []

        if use_octet_stream:
            for file in files:
                file_path, file_data = file["path"], file["data"]

                params = {"path": file_path}
                if username:
                    params["username"] = username

                headers = {"Content-Type": "application/octet-stream", **extra_headers}
                if gzip:
                    headers["Content-Encoding"] = "gzip"

                r = self._envd_api.post(
                    ENVD_API_FILES_ROUTE,
                    content=to_upload_body(file_data, gzip),
                    headers=headers,
                    params=params,
                    timeout=self._connection_config.get_request_timeout(
                        request_timeout
                    ),
                )

                err = _handle_filesystem_envd_api_exception(r)
                if err:
                    raise err

                write_result = r.json()

                if not isinstance(write_result, list) or len(write_result) == 0:
                    raise SandboxException(
                        "Expected to receive information about written file"
                    )

                results.extend([WriteInfo.from_dict(f) for f in write_result])
        else:
            params = {}
            if username:
                params["username"] = username
            if len(files) == 1:
                params["path"] = files[0]["path"]

            httpx_files = [_to_httpx_file(file["path"], file["data"]) for file in files]

            if len(httpx_files) == 0:
                return []

            r = self._envd_api.post(
                ENVD_API_FILES_ROUTE,
                files=httpx_files,
                params=params,
                headers=extra_headers,
                timeout=self._connection_config.get_request_timeout(request_timeout),
            )

            err = _handle_filesystem_envd_api_exception(r)
            if err:
                raise err

            write_result = r.json()

            if not isinstance(write_result, list) or len(write_result) == 0:
                raise SandboxException(
                    "Expected to receive information about written file"
                )

            results.extend([WriteInfo.from_dict(f) for f in write_result])

        return results

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
                # Skip entries with an unknown file type.
                if map_file_type(entry.type):
                    entries.append(map_entry_info(entry))

            return entries
        except Exception as e:
            raise _handle_filesystem_rpc_exception(e)

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
            raise _handle_filesystem_rpc_exception(e)

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

            return map_entry_info(r.entry)
        except Exception as e:
            raise _handle_filesystem_rpc_exception(e)

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
            raise _handle_filesystem_rpc_exception(e)

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

            return map_entry_info(r.entry)
        except Exception as e:
            raise _handle_filesystem_rpc_exception(e)

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
            raise _handle_filesystem_rpc_exception(e)

    def watch_dir(
        self,
        path: str,
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        recursive: bool = False,
        include_entry: bool = False,
    ) -> WatchHandle:
        """
        Watch directory for filesystem events.

        :param path: Path to a directory to watch
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**
        :param recursive: Watch directory recursively
        :param include_entry: Include the `EntryInfo` of the affected entry in each event, when available. Requires envd 0.6.3 or later

        :return: `WatchHandle` object for stopping watching directory
        """
        if recursive and self._envd_version < ENVD_VERSION_RECURSIVE_WATCH:
            raise TemplateException(
                "You need to update the template to use recursive watching."
            )

        if include_entry and self._envd_version < ENVD_VERSION_FS_EVENT_ENTRY_INFO:
            raise TemplateException(
                "You need to update the template to include entry info in watch events."
            )

        try:
            r = self._rpc.create_watcher(
                filesystem_pb2.CreateWatcherRequest(
                    path=path, recursive=recursive, include_entry=include_entry
                ),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers={
                    **authentication_header(self._envd_version, user),
                    KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
                },
            )
        except Exception as e:
            raise _handle_filesystem_rpc_exception(e)

        return WatchHandle(lambda: self._rpc, r.watcher_id)
