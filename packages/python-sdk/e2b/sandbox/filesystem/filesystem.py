import connect
import requests
import urllib.parse
import httpcore

from io import IOBase
from typing import (
    Iterator,
    List,
    Optional,
    overload,
    Literal,
    Union,
    IO,
)

from e2b.sandbox.filesystem.watch_handle import WatchHandle
from e2b.connection_config import SandboxException, Username, ConnectionConfig
from e2b.envd.filesystem import filesystem_connect, filesystem_pb2
from e2b.envd.permissions.permissions_pb2 import User
from e2b.envd.api import ENVD_API_FILES_ROUTE


class Filesystem:
    def __init__(
        self,
        envd_api_url: str,
        connection_config: ConnectionConfig,
        pool: httpcore.ConnectionPool,
    ) -> None:
        self._envd_api_url = envd_api_url
        self._connection_config = connection_config

        self._rpc = filesystem_connect.FilesystemClient(
            envd_api_url,
            compressor=connect.GzipCompressor,
            pool=pool,
        )

    @overload
    def read(
        self,
        path: str,
        format: Literal["text"] = "text",
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> str: ...

    @overload
    def read(
        self,
        path: str,
        format: Literal["bytes"],
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> bytearray: ...

    @overload
    def read(
        self,
        path: str,
        format: Literal["stream"],
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> Iterator[bytes]: ...

    def read(
        self,
        path: str,
        format: Literal["text", "bytes", "stream"] = "text",
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ):
        url = urllib.parse.urljoin(self._envd_api_url, f"{ENVD_API_FILES_ROUTE}")
        r = requests.get(
            url,
            stream=True if format == "stream" else False,
            params={"path": path, "username": user},
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

        if format == "text":
            return r.text
        elif format == "bytes":
            return bytearray(r.content)
        elif format == "stream":
            iter: Iterator[bytes] = r.iter_content()
            return iter

    def write(
        self,
        path: str,
        data: Union[str, bytes, IOBase, IO],
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> None:
        url = urllib.parse.urljoin(self._envd_api_url, f"{ENVD_API_FILES_ROUTE}")

        files = {"file": data}
        r = requests.post(
            url,
            files=files,
            params={"path": path, "username": user},
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

    def list(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> List[filesystem_pb2.EntryInfo]:
        res = self._rpc.list_dir(
            filesystem_pb2.ListDirRequest(
                path=path,
                user=User(username=user),
            ),
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

        return [entry for entry in res.entries]

    def exists(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> bool:
        try:
            self._rpc.stat(
                filesystem_pb2.StatRequest(
                    path=path,
                    user=User(username=user),
                ),
                timeout=self._connection_config.get_request_timeout(request_timeout),
            )
            return True

        except connect.ConnectException as e:
            if e.status == connect.Code.already_exists:
                return False
            raise

    def remove(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> None:
        self._rpc.remove(
            filesystem_pb2.RemoveRequest(
                path=path,
                user=User(username=user),
            ),
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

    def rename(
        self,
        old_path: str,
        new_path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> None:
        self._rpc.move(
            filesystem_pb2.MoveRequest(
                source=old_path,
                destination=new_path,
                user=User(username=user),
            ),
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

    def make_dir(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
    ) -> bool:
        try:
            self._rpc.make_dir(
                filesystem_pb2.MakeDirRequest(
                    path=path,
                    user=User(username=user),
                ),
                timeout=self._connection_config.get_request_timeout(request_timeout),
            )

            return True
        except connect.ConnectException as e:
            if e.status == connect.Code.already_exists:
                return False
            raise

    def watch(
        self,
        path: str,
        user: Username = "user",
        request_timeout: Optional[float] = None,
        timeout: Optional[float] = None,
    ):
        events = self._rpc.watch_dir(
            filesystem_pb2.WatchDirRequest(
                path=path,
                user=User(username=user),
            ),
            timeout=(
                self._connection_config.get_request_timeout(request_timeout),
                timeout,
            ),
        )

        try:
            start_event = next(events)

            return WatchHandle(events=events)
        except Exception as e:
            raise SandboxException(f"Failed to start watch: {e}")
