import logging
import connect

from typing import List, Optional, Literal
from e2b.envd import EnvdApiClient, client

from envd.filesystem.v1 import filesystem_connect, filesystem_pb2

logger = logging.getLogger(__name__)


# TODO: Provide a way to cancel requests (watch)
class Filesystem:
    def __init__(self, base_url: str, envd_api_client: EnvdApiClient) -> None:
        self._envd_api = envd_api_client

        self._service = filesystem_connect.FilesystemServiceClient(
            base_url,
            compressor=connect.GzipCompressor,
        )

    def read(self, path: str, request_timeout: Optional[float]) -> bytearray:
        # TODO: Check if exceptions are properly thrown
        # TODO: Add support for formats

        return client.FilesApi(self._envd_api).files_path_get(
            path=path,
            _request_timeout=request_timeout,
        )

    def write(
        self,
        path: str,
        data: bytes,
        request_timeout: Optional[float],
        user: Literal["root", "user"] = "user",
    ) -> None:
        client.FilesApi(self._envd_api).files_path_put(
            path=path,
            user=user,
            mode=mode,
            data=data,
            _request_timeout=request_timeout,
        )

    def list(self, path: str) -> List[filesystem_pb2.EntryInfo]:
        res = self._service.list(
            filesystem_pb2.ListRequest(path=path),
        )
        return [entry for entry in res.entries]

    def stat(self, path: str) -> filesystem_pb2.EntryInfo:
        res = self._service.stat(
            filesystem_pb2.StatRequest(path=path),
        )
        return res.entry

    def remove(self, path: str) -> None:
        self._service.remove(
            filesystem_pb2.RemoveRequest(path=path),
        )

    def watch(
        self,
        path: str,
        request_timeout: Optional[float],
    ):
        events = self._service.watch(
            filesystem_pb2.WatchRequest(path=path),
        )

        def stream():
            for event in events:
                yield event.event

        return stream()

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
