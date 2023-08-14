import base64

from typing import List, Any
from pydantic import BaseModel

from e2b.session.session_connection import SessionConnection
from e2b.session.filesystem_watcher import FilesystemWatcher
from e2b.session.session_rpc import RpcException
from e2b.session.exception import FilesystemException


class FileInfo(BaseModel):
    """
    Information about a file or a directory in the environment.
    """

    is_dir: bool
    name: str


class FilesystemManager:
    """
    Filesystem manager is used to read, write, remove and list files and directories in the environment.
    """

    _service_name = "filesystem"

    def __init__(self, session: SessionConnection):
        self._session = session

    # async def read_bytes(self, path: str) -> bytearray:
    #     """
    #     Reads the whole content of a file as a byte array.
    #     This can be used when you cannot represent the data as an UTF-8 string.

    #     :param path: path to a file
    #     :return: byte array representing the content of a file
    #     """
    #     result: str = await self.session.call(
    #         self.service_name, "readBase64", [path]
    #     )
    #     return bytearray(result, "base64")

    # async def write_bytes(self, path: str, content: bytearray) -> None:
    #     """
    #     Writes content to a file as a byte array.
    #     This can be used when you cannot represent the data as an UTF-8 string.

    #     :param path: path to a file
    #     :param content: byte array representing the content to write
    #     """
    #     base64_content = base64.b64encode(content).decode("utf-8")
    #     await self.session.call(
    #         self.service_name, "writeBase64", [path, base64_content]
    #     )

    async def read(self, path: str) -> str:
        """
        Reads the whole content of a file as an array of bytes.

        :param path: path to a file
        :return: content of a file
        """
        try:
            result: str = await self._session._call(self._service_name, "read", [path])
            return result
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def write(self, path: str, content: str) -> None:
        """
        Writes content to a file.

        :param path: path to a file
        :param content: content to write
        """
        try:
            await self._session._call(self._service_name, "write", [path, content])
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def remove(self, path: str) -> None:
        """
        Removes a file or a directory.

        :param path: path to a file or a directory
        """
        try:
            await self._session._call(self._service_name, "remove", [path])
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def list(self, path: str) -> List[FileInfo]:
        """
        List files in a directory.

        :param path: path to a directory
        :return: array of files in a directory
        """
        try:
            result: List[Any] = await self._session._call(
                self._service_name, "list", [path]
            )
            return [
                FileInfo(is_dir=file_info["isDir"], name=file_info["name"])
                for file_info in result
            ]
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def make_dir(self, path: str) -> None:
        """
        Creates a new directory and all directories along the way if needed on the specified path.

        :param path: path to a new directory. For example '/dirA/dirB' when creating 'dirB'
        """
        try:
            await self._session._call(self._service_name, "makeDir", [path])
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def watch_dir(self, path: str) -> FilesystemWatcher:
        """
        Watches directory for filesystem events.

        :param path: path to a directory that will be watched

        :return: New watcher
        """
        return FilesystemWatcher(
            connection=self._session,
            path=path,
            service_name=self._service_name,
        )
