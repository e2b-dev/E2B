import e2b_connect as connect
import httpx
import httpcore
from io import TextIOBase

from typing import (
    AsyncIterator,
    List,
    Optional,
    overload,
    Literal,
    Union,
    IO,
)

from e2b.sandbox.filesystem.filesystem import EntryInfo, map_file_type
from e2b.connection_config import Username, ConnectionConfig
from e2b.exceptions import SandboxException
from e2b.envd.api import ahandle_envd_api_exception
from e2b.envd.rpc import authentication_header, handle_rpc_exception
from e2b.envd.filesystem import filesystem_connect, filesystem_pb2
from e2b.envd.api import ENVD_API_FILES_ROUTE
from e2b.sandbox_async.filesystem.watch_handle import AsyncWatchHandle
from e2b.sandbox.filesystem.watch_handle import FilesystemEvent
from e2b.sandbox_async.utilts import OutputHandler


class Filesystem:
    def __init__(
        self,
        envd_api_url: str,
        connection_config: ConnectionConfig,
        pool: httpcore.AsyncConnectionPool,
        envd_api: httpx.AsyncClient,
    ) -> None:
        self._envd_api_url = envd_api_url
        self._connection_config = connection_config
        self._pool = pool
        self._envd_api = envd_api

        self._rpc = filesystem_connect.FilesystemClient(
            envd_api_url,
            # TODO: Fix and enable compression again — the headers compression is not solved for streaming.
            # compressor=e2b_connect.GzipCompressor,
            async_pool=pool,
        )

    @overload
    async def read(
        self,
        path: str,
        format: Literal["text"] = "text",
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> str: ...

    @overload
    async def read(
        self,
        path: str,
        format: Literal["bytes"],
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> bytearray: ...

    @overload
    async def read(
        self,
        path: str,
        format: Literal["stream"],
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> AsyncIterator[bytes]: ...

    async def read(
        self,
        path: str,
        format: Literal["text", "bytes", "stream"] = "text",
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ):
        r = await self._envd_api.get(
            ENVD_API_FILES_ROUTE,
            params={"path": path, "username": user},
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
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> EntryInfo:
        if isinstance(data, TextIOBase):
            data = data.read().encode()

        r = await self._envd_api.post(
            ENVD_API_FILES_ROUTE,
            files={"file": data},
            params={"path": path, "username": user},
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

        err = await ahandle_envd_api_exception(r)
        if err:
            raise err

        files = r.json()

        if not isinstance(files, list) or len(files) == 0:
            raise Exception("Expected to receive information about written file")

        file = files[0]
        return EntryInfo(**file)

    async def list(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> List[EntryInfo]:
        try:
            res = await self._rpc.alist_dir(
                filesystem_pb2.ListDirRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(user),
            )

            entries: List[EntryInfo] = []
            for entry in res.entries:
                event_type = map_file_type(entry.type)

                if event_type:
                    entries.append(EntryInfo(name=entry.name, type=event_type, path=entry.path))

            return entries
        except Exception as e:
            raise handle_rpc_exception(e)

    async def exists(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> bool:
        try:
            await self._rpc.astat(
                filesystem_pb2.StatRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(user),
            )

            return True

        except Exception as e:
            if isinstance(e, connect.ConnectException):
                if e.status == connect.Code.not_found:
                    return False
            raise handle_rpc_exception(e)

    async def remove(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> None:
        try:
            await self._rpc.aremove(
                filesystem_pb2.RemoveRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(user),
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    async def rename(
        self,
        old_path: str,
        new_path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> EntryInfo:
        try:
            r = await self._rpc.amove(
                filesystem_pb2.MoveRequest(
                    source=old_path,
                    destination=new_path,
                ),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(user),
            )
            return r.entry
        except Exception as e:
            raise handle_rpc_exception(e)

    async def make_dir(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> bool:
        try:
            await self._rpc.amake_dir(
                filesystem_pb2.MakeDirRequest(path=path),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(user),
            )

            return True
        except Exception as e:
            if isinstance(e, connect.ConnectException):
                if e.status == connect.Code.already_exists:
                    return False
            raise handle_rpc_exception(e)

    async def watch(
        self,
        path: str,
        on_event: OutputHandler[FilesystemEvent],
        on_exit: Optional[OutputHandler[Exception]] = None,
        user: Username = "user",
        request_timeout: Optional[float] = None,
        timeout: Optional[float] = 60,
    ):
        events = self._rpc.awatch_dir(
            filesystem_pb2.WatchDirRequest(path=path),
            request_timeout=self._connection_config.get_request_timeout(
                request_timeout
            ),
            timeout=timeout,
            headers=authentication_header(user),
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
