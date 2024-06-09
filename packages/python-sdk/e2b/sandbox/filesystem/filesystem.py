import connect
import requests
import urllib.parse

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
from e2b.connection_config import Username
from e2b.envd.filesystem import filesystem_connect, filesystem_pb2
from e2b.envd.permissions.permissions_pb2 import User
from e2b.envd.api import ENVD_API_FILES_ROUTE

READ_CHUNK_SIZE = 2 << 16  # 64KiB


class Filesystem:
    def __init__(self, envd_api_url: str) -> None:
        self._envd_api_url = envd_api_url

        self._rpc = filesystem_connect.FilesystemClient(
            envd_api_url,
            compressor=connect.GzipCompressor,
        )

    @overload
    def read(
        self,
        path: str,
        format: Literal["text"] = "text",
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> str: ...

    @overload
    def read(
        self,
        path: str,
        format: Literal["bytes"],
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> bytearray: ...

    @overload
    def read(
        self,
        path: str,
        format: Literal["stream"],
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> Iterator[bytes]: ...

    def read(
        self,
        path: str,
        format: Literal["text", "bytes", "stream"] = "text",
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ):
        url = urllib.parse.urljoin(self._envd_api_url, f"/{ENVD_API_FILES_ROUTE}")
        r = requests.get(
            url,
            params={"path": path, "username": user},
            timeout=request_timeout,
        )

        if format == "text":
            return r.text
        elif format == "bytes":
            return bytearray(r.content)
        elif format == "stream":
            iter: Iterator[bytes] = r.iter_content(chunk_size=READ_CHUNK_SIZE)
            return iter

    def write(
        self,
        path: str,
        data: Union[str, bytes, IOBase, IO],
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> None:
        url = urllib.parse.urljoin(self._envd_api_url, f"/{ENVD_API_FILES_ROUTE}")
        files = {"file": data}
        r = requests.post(
            url,
            files=files,
            params={"path": path, "username": user},
            timeout=request_timeout,
        )

    def list(
        self,
        path: str,
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> List[filesystem_pb2.EntryInfo]:
        res = self._rpc.list(
            filesystem_pb2.ListRequest(path=path),
            user=User(username=user),
            timeout=request_timeout,
        )
        return [entry for entry in res.entries]

    def exists(
        self,
        path: str,
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> bool:
        try:
            self._rpc.stat(
                filesystem_pb2.StatRequest(path=path),
                user=User(username=user),
                timeout=request_timeout,
            )
            return True

        except connect.Error as e:
            if e.code == connect.Code.not_found:
                return False
            raise

    def remove(
        self,
        path: str,
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> None:
        self._rpc.remove(
            filesystem_pb2.RemoveRequest(
                path=path,
                user=User(username=user),
            ),
            timeout=request_timeout,
        )

    def make_dir(
        self,
        path: str,
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> None:
        self._rpc.make_dir(
            filesystem_pb2.MakeDirRequest(
                path=path,
                user=User(username=user),
            ),
            timeout=request_timeout,
        )

    def watch(
        self,
        path: str,
        request_timeout: Optional[float] = None,
        user: Username = "user",
        timeout: Optional[float] = None,
    ):
        events = self._rpc.watch(
            filesystem_pb2.WatchRequest(path=path),
            user=User(username=user),
            timeout=(request_timeout, timeout),
        )

        return WatchHandle(events=events)
