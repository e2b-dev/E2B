from io import BytesIO, RawIOBase
import connect

from typing import IO, List, Optional, TextIO, overload, Literal, Union

from e2b.envd import EnvdApiClient, client
from e2b.sandbox.filesystem.watch_handle import WatchHandle
from e2b.connection_config import Username
from envd.filesystem import filesystem_connect, filesystem_pb2


FileFormat = Literal["text", "bytes", "stream"]


class Filesystem:
    def __init__(self, envd_api_url: str) -> None:
        self._envd_api = EnvdApiClient(api_url=envd_api_url)

        self._rpc = filesystem_connect.FilesystemServiceClient(
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
    ) -> BytesIO: ...

    def read(
        self,
        path: str,
        format: FileFormat = "text",
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ):
        res = client.FilesApi(self._envd_api).files_path_get(
            path=path,
            _request_timeout=request_timeout,
        )

        if format == "text":
            return res.decode()

        return res

    @overload
    def write(
        self,
        path: str,
        data: str,
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> None: ...

    @overload
    def write(
        self,
        path: str,
        data: bytes,
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> None: ...

    @overload
    def write(
        self,
        path: str,
        data: BytesIO,
        request_timeout: Optional[float] = None,
        user: Username = "user",
    ) -> None: ...

    def write(
        self,
        path: str,
        data: Union[bytes, str, BytesIO],
        request_timeout: Optional[float],
        user: Username = "user",
    ) -> None:
        client.FilesApi(self._envd_api).files_path_put(
            path=path,
            user=user,
            mode=mode,
            data=data,
            _request_timeout=request_timeout,
        )

    def list(self, path: str) -> List[filesystem_pb2.EntryInfo]:
        res = self._rpc.list(
            filesystem_pb2.ListRequest(path=path),
        )
        return [entry for entry in res.entries]

    def exists(self, path: str) -> bool:
        try:
            self._rpc.stat(
                filesystem_pb2.StatRequest(path=path),
            )
            return True

        except connect.Error as e:
            if e.code == connect.Code.not_found:
                return False
            raise

    def remove(self, path: str) -> None:
        self._rpc.remove(
            filesystem_pb2.RemoveRequest(path=path),
        )

    def watch(
        self,
        path: str,
        request_timeout: Optional[float],
    ):
        events = self._rpc.watch(
            filesystem_pb2.WatchRequest(path=path),
        )

        return WatchHandle(events=events)

    # def upload_file(self, file: IO, timeout: Optional[float] = TIMEOUT) -> str:
    #     """
    #     Upload a file to the sandbox.
    #     The file will be uploaded to the user's home (`/home/user`) directory with the same name.
    #     If a file with the same name already exists, it will be overwritten.

    #     :param file: The file to upload
    #     :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
    #     """
    #     files = {"file": file}
    #     r = requests.post(self.file_url(), files=files, timeout=timeout)
    #     if r.status_code != 200:
    #         raise Exception(f"Failed to upload file: {r.reason} {r.text}")

    #     filename = path.basename(file.name)
    #     return f"/home/user/{filename}"

    # def download_file(
    #     self, remote_path: str, timeout: Optional[float] = TIMEOUT
    # ) -> bytes:
    #     """
    #     Download a file from the sandbox and returns it's content as bytes.

    #     :param remote_path: The path of the file to download
    #     :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
    #     """
    #     encoded_path = urllib.parse.quote(remote_path)
    #     url = f"{self.file_url()}?path={encoded_path}"
    #     r = requests.get(url, timeout=timeout)

    #     if r.status_code != 200:
    #         raise Exception(
    #             f"Failed to download file '{remote_path}'. {r.reason} {r.text}"
    #         )
    #     return r.content
