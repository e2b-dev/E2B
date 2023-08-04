import base64

from pathlib import Path, PosixPath
from typing import ClassVar, List, Any
from pydantic import BaseModel, PrivateAttr

from e2b_sdk.session.session_connection import SessionConnection
from e2b_sdk.session.filesystem_watcher import FilesystemWatcher


class FileInfo(BaseModel):
    is_dir: bool
    name: str


class FilesystemManager(BaseModel):
    service_name: ClassVar[str] = "filesystem"

    session_connection: SessionConnection = PrivateAttr()

    # async def read_bytes(self, path: str) -> bytearray:
    #     """
    #     Reads the whole content of a file as a byte array.
    #     This can be used when you cannot represent the data as an UTF-8 string.

    #     :param path: path to a file
    #     :return: byte array representing the content of a file
    #     """
    #     result: str = await self.session_connection.call(
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
    #     await self.session_connection.call(
    #         self.service_name, "writeBase64", [path, base64_content]
    #     )

    async def read(self, path: str) -> str:
        """
        Reads the whole content of a file as an array of bytes.

        :param path: path to a file
        :return: content of a file
        """
        result: str = await self.session_connection.call(
            self.service_name, "read", [path]
        )
        return result

    async def write(self, path: str, content: str) -> None:
        """
        Writes content to a file.

        :param path: path to a file
        :param content: content to write
        """
        await self.session_connection.call(self.service_name, "write", [path, content])

    async def remove(self, path: str) -> None:
        """
        Removes a file or a directory.

        :param path: path to a file or a directory
        """
        await self.session_connection.call(self.service_name, "remove", [path])

    async def list(self, path: str) -> List[FileInfo]:
        """
        List files in a directory.

        :param path: path to a directory
        :return: array of files in a directory
        """
        result: List[Any] = await self.session_connection.call(
            self.service_name, "list", [path]
        )
        return [FileInfo(**file_info) for file_info in result]

    async def make_dir(self, path: str) -> None:
        """
        Creates a new directory and all directories along the way if needed on the specified path.

        :param path: path to a new directory. For example '/dirA/dirB' when creating 'dirB'
        """
        await self.session_connection.call(self.service_name, "makeDir", [path])

    async def watch_dir(self, path: str) -> FilesystemWatcher:
        """
        Watches directory for filesystem events.

        :param path: path to a directory that will be watched
        :return: new watcher
        """
        npath = PosixPath(Path(path).resolve())
        return FilesystemWatcher(
            session_connection=self.session_connection, path=str(npath)
        )
