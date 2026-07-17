import asyncio
from typing import IO, Dict, List, Literal, Optional, Union, overload


import httpx
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from packaging.version import Version

from e2b.connection_config import (
    KEEPALIVE_PING_HEADER,
    KEEPALIVE_PING_INTERVAL_SEC,
    ConnectionConfig,
    Username,
    default_username,
)
from e2b.envd.api import (
    ENVD_API_FILES_ROUTE,
    acheck_sandbox_health,
    ahandle_envd_api_exception,
    ahandle_envd_api_transport_exception_with_health,
)
from protobuf import Oneof

from e2b.envd.filesystem import filesystem_connect, filesystem_pb
from e2b.envd.rpc import (
    authentication_header,
    ahandle_rpc_exception_with_health,
    timeout_to_ms,
)
from e2b.envd.transport import as_async_stream, create_rpc_client
from e2b.envd.versions import (
    ENVD_DEFAULT_USER,
    ENVD_FILE_METADATA,
    ENVD_OCTET_STREAM_UPLOAD,
    ENVD_VERSION_FS_EVENT_ENTRY_INFO,
    ENVD_VERSION_RECURSIVE_WATCH,
    ENVD_VERSION_WATCH_NETWORK_MOUNTS,
)
from e2b.exceptions import (
    FileNotFoundException,
    InvalidArgumentException,
    SandboxException,
    TemplateException,
)
from e2b.sandbox.filesystem.filesystem import (
    AsyncFileStreamReader,
    EntryInfo,
    WriteEntry,
    WriteInfo,
    _to_httpx_file,
    map_entry_info,
    map_file_type,
    metadata_to_headers,
    to_upload_body_async,
    validate_metadata,
)
from e2b.sandbox.filesystem.watch_handle import FilesystemEvent
from e2b.sandbox_async.filesystem.watch_handle import AsyncWatchHandle
from e2b.sandbox_async.utils import OutputHandler

_FILESYSTEM_RPC_ERROR_MAP = {
    Code.NOT_FOUND: FileNotFoundException,
}

_FILESYSTEM_HTTP_ERROR_MAP = {
    404: FileNotFoundException,
}


async def _ahandle_filesystem_rpc_exception(
    e: Exception, envd_api: httpx.AsyncClient
) -> Exception:
    return await ahandle_rpc_exception_with_health(
        e, lambda: acheck_sandbox_health(envd_api), _FILESYSTEM_RPC_ERROR_MAP
    )


async def _ahandle_filesystem_envd_api_exception(r):
    return await ahandle_envd_api_exception(r, _FILESYSTEM_HTTP_ERROR_MAP)


class Filesystem:
    """
    Module for interacting with the filesystem in the sandbox.
    """

    def __init__(
        self,
        envd_api_url: str,
        envd_version: Version,
        connection_config: ConnectionConfig,
        envd_api: httpx.AsyncClient,
    ) -> None:
        self._envd_api_url = envd_api_url
        self._envd_version = envd_version
        self._connection_config = connection_config
        self._envd_api = envd_api

        self._rpc = create_rpc_client(
            filesystem_connect.FilesystemClient,
            envd_api_url,
            connection_config,
            sync=False,
        )

    @overload
    async def read(
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
    async def read(
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
    async def read(
        self,
        path: str,
        format: Literal["stream"],
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        gzip: bool = False,
        stream_idle_timeout: Optional[float] = None,
    ) -> AsyncFileStreamReader:
        """
        Read file content as an `AsyncFileStreamReader` (an `AsyncIterator[bytes]`).

        The request timeout bounds only the initial handshake—the returned
        iterator is not killed by it while being consumed. A stalled stream is
        reclaimed by `stream_idle_timeout` (raising `httpx.ReadTimeout`). The
        reader releases its connection once fully consumed; if you don't read it
        to the end, use it as an async context manager or call `aclose()` for
        deterministic cleanup. There is no garbage-collection safety net—an
        abandoned stream holds its connection until the idle timeout fires or
        the client is closed.

        :param path: Path to the file
        :param user: Run the operation as this user
        :param format: Format of the file content—`stream`
        :param request_timeout: Timeout for the request in **seconds**
        :param gzip: Use gzip compression for the request
        :param stream_idle_timeout: Idle timeout in **seconds** for the streamed
            body—abort if no chunk arrives within this window. Resets on every
            chunk, so it bounds a stalled stream without limiting total transfer
            time. Defaults to the request timeout; pass `0` to disable.

        :return: File content as an `AsyncFileStreamReader`
        """
        ...

    async def read(
        self,
        path: str,
        format: Literal["text", "bytes", "stream"] = "text",
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        gzip: bool = False,
        stream_idle_timeout: Optional[float] = None,
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

        timeout = self._connection_config.get_request_timeout(request_timeout)

        if format == "stream":
            # Stream the response body instead of buffering it in memory.
            request = self._envd_api.build_request(
                "GET",
                ENVD_API_FILES_ROUTE,
                params=params,
                headers=headers,
                timeout=timeout,
            )
            try:
                r = await self._envd_api.send(request, stream=True)
            except httpx.RemoteProtocolError as e:
                raise await ahandle_envd_api_transport_exception_with_health(
                    e, self._envd_api
                )

            err = await _ahandle_filesystem_envd_api_exception(r)
            if err:
                await r.aclose()
                raise err

            # The request timeout bounds only the initial handshake; httpx's
            # per-chunk `read` timeout becomes the idle-read timeout for the body
            # (defaults to the request timeout). The timeout dict is shared by
            # reference with the transport and read again when iteration starts.
            idle_timeout = (
                timeout if stream_idle_timeout is None else stream_idle_timeout
            )
            request.extensions.get("timeout", {})["read"] = idle_timeout or None

            return AsyncFileStreamReader(r)

        try:
            r = await self._envd_api.get(
                ENVD_API_FILES_ROUTE,
                params=params,
                headers=headers,
                timeout=timeout,
            )
        except httpx.RemoteProtocolError as e:
            raise await ahandle_envd_api_transport_exception_with_health(
                e, self._envd_api
            )

        err = await _ahandle_filesystem_envd_api_exception(r)
        if err:
            raise err

        if format == "text":
            return r.text
        elif format == "bytes":
            return bytearray(r.content)

    async def write(
        self,
        path: str,
        data: Union[str, bytes, IO],
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        gzip: bool = False,
        use_octet_stream: Optional[bool] = None,
        metadata: Optional[Dict[str, str]] = None,
    ) -> WriteInfo:
        """
        Write content to a file on the path.
        Writing to a file that doesn't exist creates the file.
        Writing to a file that already exists overwrites the file.
        Writing to a file at path that doesn't exist creates the necessary directories.

        :param path: Path to the file
        :param data: Data to write to the file, can be a `str`, `bytes`, or `IO`. File-like objects are streamed in chunks instead of being buffered in memory.
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**
        :param gzip: Use gzip compression for the upload. Implies the `application/octet-stream` upload. Requires envd 0.5.7 or later — when not supported, the upload falls back to uncompressed `multipart/form-data`.
        :param use_octet_stream: Upload using `application/octet-stream` instead of `multipart/form-data`. Defaults to `None`, which uses octet-stream when `data` is a file-like object (so streamed uploads aren't buffered) and `multipart/form-data` otherwise. Requires envd 0.5.7 or later — when not supported, the upload falls back to `multipart/form-data`.
        :param metadata: User-defined metadata to persist on the uploaded file as extended attributes. Keys are lowercased by the sandbox; invalid keys or values raise an `InvalidArgumentException`. Requires envd 0.6.2 or later.

        :return: Information about the written file
        """
        result = await self.write_files(
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

    async def write_files(
        self,
        files: List[WriteEntry],
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        gzip: bool = False,
        use_octet_stream: Optional[bool] = None,
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
        :param gzip: Use gzip compression for the upload. Implies the `application/octet-stream` upload. Requires envd 0.5.7 or later — when not supported, the upload falls back to uncompressed `multipart/form-data`.
        :param use_octet_stream: Upload using `application/octet-stream` instead of `multipart/form-data`. Defaults to `None`, which uses octet-stream when any entry is a file-like object (so streamed uploads aren't buffered) and `multipart/form-data` otherwise. Requires envd 0.5.7 or later — when not supported, the upload falls back to `multipart/form-data`.
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

        # A file-like entry is streamed; str/bytes are sent from memory.
        has_streamable_data = any(
            not isinstance(file["data"], (str, bytes)) for file in files
        )

        if use_octet_stream is None:
            # Streaming an upload only happens on the octet-stream path; the
            # multipart path buffers file-like data. Default to octet-stream
            # when any entry is a file-like object so a streamed upload isn't
            # silently buffered.
            use_octet_stream = has_streamable_data

        supports_octet_stream = self._envd_version >= ENVD_OCTET_STREAM_UPLOAD
        # Gzip compression only works with the octet-stream upload (the
        # Content-Encoding header applies to the whole request body), so
        # requesting gzip implies it when envd supports it.
        use_octet_stream = (use_octet_stream or gzip) and supports_octet_stream

        # Each chunk send is bounded by the request timeout (httpx applies it
        # per write); a stalled upload the per-write timeout can't observe is
        # bounded server-side (envd's per-read idle timeout, envd >= 0.6.7).
        upload_timeout = self._connection_config.get_request_timeout(request_timeout)

        # Metadata is sent as request-scoped X-Metadata-* headers, so the same
        # metadata is applied to every file in a multi-file upload.
        extra_headers = metadata_to_headers(metadata)

        results: List[WriteInfo] = []

        if use_octet_stream:

            async def _upload_file(file):
                file_path, file_data = file["path"], file["data"]

                params = {"path": file_path}
                if username:
                    params["username"] = username

                headers = {"Content-Type": "application/octet-stream", **extra_headers}
                if gzip:
                    headers["Content-Encoding"] = "gzip"

                try:
                    r = await self._envd_api.post(
                        ENVD_API_FILES_ROUTE,
                        content=to_upload_body_async(file_data, gzip),
                        headers=headers,
                        params=params,
                        timeout=upload_timeout,
                    )
                except httpx.RemoteProtocolError as e:
                    raise await ahandle_envd_api_transport_exception_with_health(
                        e, self._envd_api
                    )

                err = await _ahandle_filesystem_envd_api_exception(r)
                if err:
                    raise err

                write_result = r.json()

                if not isinstance(write_result, list) or len(write_result) == 0:
                    raise SandboxException(
                        "Expected to receive information about written file"
                    )

                return [WriteInfo.from_dict(f) for f in write_result]

            upload_results = await asyncio.gather(
                *[_upload_file(file) for file in files]
            )
            for file_results in upload_results:
                results.extend(file_results)
        else:
            params = {}
            if username:
                params["username"] = username
            if len(files) == 1:
                params["path"] = files[0]["path"]

            httpx_files = [_to_httpx_file(file["path"], file["data"]) for file in files]

            if len(httpx_files) == 0:
                return []

            try:
                r = await self._envd_api.post(
                    ENVD_API_FILES_ROUTE,
                    files=httpx_files,
                    params=params,
                    headers=extra_headers,
                    timeout=upload_timeout,
                )
            except httpx.RemoteProtocolError as e:
                raise await ahandle_envd_api_transport_exception_with_health(
                    e, self._envd_api
                )

            err = await _ahandle_filesystem_envd_api_exception(r)
            if err:
                raise err

            write_result = r.json()

            if not isinstance(write_result, list) or len(write_result) == 0:
                raise SandboxException(
                    "Expected to receive information about written file"
                )

            results.extend([WriteInfo.from_dict(f) for f in write_result])

        return results

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
            res = await self._rpc.list_dir(
                filesystem_pb.ListDirRequest(path=path, depth=depth or 0),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
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
            raise await _ahandle_filesystem_rpc_exception(e, self._envd_api)

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
            await self._rpc.stat(
                filesystem_pb.StatRequest(path=path),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
                ),
                headers=authentication_header(self._envd_version, user),
            )

            return True

        except Exception as e:
            if isinstance(e, ConnectError):
                if e.code == Code.NOT_FOUND:
                    return False
            raise await _ahandle_filesystem_rpc_exception(e, self._envd_api)

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
            r = await self._rpc.stat(
                filesystem_pb.StatRequest(path=path),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
                ),
                headers=authentication_header(self._envd_version, user),
            )

            return map_entry_info(r.entry or filesystem_pb.EntryInfo())
        except Exception as e:
            raise await _ahandle_filesystem_rpc_exception(e, self._envd_api)

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
            await self._rpc.remove(
                filesystem_pb.RemoveRequest(path=path),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
                ),
                headers=authentication_header(self._envd_version, user),
            )
        except Exception as e:
            raise await _ahandle_filesystem_rpc_exception(e, self._envd_api)

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
            r = await self._rpc.move(
                filesystem_pb.MoveRequest(
                    source=old_path,
                    destination=new_path,
                ),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
                ),
                headers=authentication_header(self._envd_version, user),
            )

            return map_entry_info(r.entry or filesystem_pb.EntryInfo())
        except Exception as e:
            raise await _ahandle_filesystem_rpc_exception(e, self._envd_api)

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
            await self._rpc.make_dir(
                filesystem_pb.MakeDirRequest(path=path),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
                ),
                headers=authentication_header(self._envd_version, user),
            )

            return True
        except Exception as e:
            if isinstance(e, ConnectError):
                if e.code == Code.ALREADY_EXISTS:
                    return False
            raise await _ahandle_filesystem_rpc_exception(e, self._envd_api)

    async def watch_dir(
        self,
        path: str,
        on_event: OutputHandler[FilesystemEvent],
        on_exit: Optional[OutputHandler[Optional[Exception]]] = None,
        user: Optional[Username] = None,
        request_timeout: Optional[float] = None,
        timeout: Optional[float] = 60,
        recursive: bool = False,
        include_entry: bool = False,
        allow_network_mounts: bool = False,
    ) -> AsyncWatchHandle:
        """
        Watch directory for filesystem events.

        :param path: Path to a directory to watch
        :param on_event: Callback to call on each event in the directory
        :param on_exit: Callback to call when the watching ends. It receives the error that ended the watch, or `None` on a clean end or when `stop()` is called
        :param user: Run the operation as this user
        :param request_timeout: Timeout for the request in **seconds**
        :param timeout: Timeout for the watch operation in **seconds**. Using `0` will not limit the watch time
        :param recursive: Watch directory recursively
        :param include_entry: Include the `EntryInfo` of the affected entry in each event, when available. Requires envd 0.6.3 or later
        :param allow_network_mounts: Allow watching paths on network filesystem mounts (NFS, CIFS, SMB, FUSE), which are rejected by default. Events on network mounts may be unreliable or not delivered at all. Requires envd 0.6.4 or later

        :return: `AsyncWatchHandle` object for stopping watching directory
        """
        if recursive and self._envd_version < ENVD_VERSION_RECURSIVE_WATCH:
            raise TemplateException(
                "You need to update the template to use recursive watching."
            )

        if include_entry and self._envd_version < ENVD_VERSION_FS_EVENT_ENTRY_INFO:
            raise TemplateException(
                "You need to update the template to include entry info in watch events."
            )

        if (
            allow_network_mounts
            and self._envd_version < ENVD_VERSION_WATCH_NETWORK_MOUNTS
        ):
            raise TemplateException(
                "You need to update the template to watch directories on network mounts."
            )

        events = as_async_stream(
            self._rpc.watch_dir(
                filesystem_pb.WatchDirRequest(
                    path=path,
                    recursive=recursive,
                    include_entry=include_entry,
                    allow_network_mounts=allow_network_mounts,
                ),
                # The watch `timeout` bounds the whole stream; `request_timeout`
                # has no per-call equivalent here — connection setup is bounded by
                # the transport's connect timeout instead.
                timeout_ms=timeout_to_ms(timeout),
                headers={
                    **authentication_header(self._envd_version, user),
                    KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
                },
            )
        )

        try:
            start_event = await events.__anext__()

            match start_event.event:
                case Oneof(field="start"):
                    pass
                case _:
                    raise SandboxException(
                        f"Failed to start watch: expected start event, got {start_event}",
                    )

            return AsyncWatchHandle(
                events=events,
                on_event=on_event,
                on_exit=on_exit,
                check_health=lambda: acheck_sandbox_health(self._envd_api),
            )
        except Exception as e:
            try:
                await events.aclose()
            except Exception:
                pass
            raise await _ahandle_filesystem_rpc_exception(e, self._envd_api)
