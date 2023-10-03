import asyncio
import base64
import logging
from typing import Any, List, Optional, Type, Union

from pydantic import BaseModel

from e2b.constants import TIMEOUT
from e2b.session.exception import FilesystemException, RpcException
from e2b.session.filesystem_watcher import FilesystemWatcher, SyncFilesystemWatcher
from e2b.session.session_connection import SessionConnection
from e2b.utils.filesystem import resolve_path

logger = logging.getLogger(__name__)


class FileInfo(BaseModel):
    """
    Information about a file or a directory in the environment.
    """

    is_dir: bool
    name: str


class BaseFilesystemManager:
    _watcher_model = Union[Type[FilesystemWatcher], Type[SyncFilesystemWatcher]]
    _service_name = "filesystem"

    def __init__(self, session: SessionConnection):
        self._session = session

    @property
    def cwd(self) -> str:
        return self._session.cwd

    async def read_bytes(self, path: str) -> bytes:
        """
        Reads the whole content of a file as a byte array.
        This can be used when you cannot represent the data as an UTF-8 string.

        :param path: path to a file
        :return: byte array representing the content of a file
        """
        path = resolve_path(path, self.cwd)
        result: str = await self._session._call(
            self._service_name, "readBase64", [path]
        )
        return base64.b64decode(result)

    async def write_bytes(self, path: str, content: bytes) -> None:
        """
        Writes content to a file as a byte array.
        This can be used when you cannot represent the data as an UTF-8 string.

        :param path: path to a file
        :param content: byte array representing the content to write
        """
        path = resolve_path(path, self.cwd)
        base64_content = base64.b64encode(content).decode("utf-8")
        await self._session._call(
            self._service_name, "writeBase64", [path, base64_content]
        )

    async def read(self, path: str, timeout: Optional[float] = TIMEOUT) -> str:
        """
        Reads the whole content of a file as an array of bytes.

        :param path: Path to a file
        :param timeout: Timeout for the call
        :return: Content of a file
        """
        logger.debug(f"Reading file {path}")

        path = resolve_path(path, self.cwd)
        try:
            result: str = await self._session._call(
                self._service_name, "read", [path], timeout=timeout
            )
            logger.debug(f"Read file {path}")
            return result
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def write(
        self, path: str, content: str, timeout: Optional[float] = TIMEOUT
    ) -> None:
        """
        Writes content to a file.

        :param path: Path to a file
        :param content: Content to write
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        logger.debug(f"Writing file {path}")

        path = resolve_path(path, self.cwd)
        try:
            await self._session._call(
                self._service_name, "write", [path, content], timeout=timeout
            )
            logger.debug(f"Wrote file {path}")
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def remove(self, path: str, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Removes a file or a directory.

        :param path: Path to a file or a directory
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        logger.debug(f"Removing file {path}")

        path = resolve_path(path, self.cwd)
        try:
            await self._session._call(
                self._service_name, "remove", [path], timeout=timeout
            )
            logger.debug(f"Removed file {path}")
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def list(
        self, path: str, timeout: Optional[float] = TIMEOUT
    ) -> List[FileInfo]:
        """
        List files in a directory.

        :param path: Path to a directory
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time

        :return: Array of files in a directory
        """
        logger.debug(f"Listing files in {path}")

        path = resolve_path(path, self.cwd)
        try:
            result: List[Any] = await self._session._call(
                self._service_name, "list", [path], timeout=timeout
            )
            logger.debug(f"Listed files in {path}, result: {result}")
            return [
                FileInfo(is_dir=file_info["isDir"], name=file_info["name"])
                for file_info in result
            ]
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def make_dir(self, path: str, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Creates a new directory and all directories along the way if needed on the specified path.

        :param path: Path to a new directory. For example '/dirA/dirB' when creating 'dirB'
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        logger.debug(f"Creating directory {path}")

        path = resolve_path(path, self.cwd)
        try:
            await self._session._call(
                self._service_name, "makeDir", [path], timeout=timeout
            )
            logger.debug(f"Created directory {path}")
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def watch_dir(
        self, path: str
    ) -> Union[FilesystemWatcher, SyncFilesystemWatcher]:
        logger.debug(f"Watching directory {path}")

        path = resolve_path(path, self.cwd)
        return self._watcher_model(
            connection=self._session,
            path=path,
            service_name=self._service_name,
        )


class FilesystemManager(BaseFilesystemManager):
    """
    Filesystem manager is used to read, write, remove and list files and directories in the environment.
    """

    _watcher_model = FilesystemWatcher

    async def watch_dir(self, path: str) -> FilesystemWatcher:
        """
        Watches directory for filesystem events.

        :param path: Path to a directory that will be watched

        :return: New watcher
        """
        return await super().watch_dir(path)


class SyncFilesystemManager(BaseFilesystemManager):
    """
    Filesystem manager is used to read, write, remove and list files and directories in the environment.
    """

    _watcher_model = SyncFilesystemWatcher

    def __init__(self, session: SessionConnection, loop: asyncio.AbstractEventLoop):
        super().__init__(session)
        self._loop = loop

    def read_bytes(self, path: str) -> bytes:
        """
        Reads the whole content of a file as a byte array.
        This can be used when you cannot represent the data as an UTF-8 string.

        :param path: path to a file
        :return: byte array representing the content of a file
        """
        return self._loop.run_until_complete(super().read_bytes(path))

    def write_bytes(self, path: str, content: bytes) -> None:
        """
        Writes content to a file as a byte array.
        This can be used when you cannot represent the data as an UTF-8 string.

        :param path: path to a file
        :param content: byte array representing the content to write
        """
        return self._loop.run_until_complete(super().write_bytes(path, content))

    def read(self, path: str, timeout: Optional[float] = TIMEOUT) -> str:
        """
        Reads the whole content of a file as an array of bytes.

        :param path: Path to a file
        :param timeout: Timeout for the call
        :return: Content of a file
        """
        return self._loop.run_until_complete(super().read(path, timeout))

    def write(
        self, path: str, content: str, timeout: Optional[float] = TIMEOUT
    ) -> None:
        """
        Writes content to a file.

        :param path: Path to a file
        :param content: Content to write
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        return self._loop.run_until_complete(super().write(path, content, timeout))

    def remove(self, path: str, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Removes a file or a directory.

        :param path: Path to a file or a directory
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        return self._loop.run_until_complete(super().remove(path, timeout))

    def list(self, path: str, timeout: Optional[float] = TIMEOUT) -> List[FileInfo]:
        """
        List files in a directory.

        :param path: Path to a directory
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time

        :return: Array of files in a directory
        """
        return self._loop.run_until_complete(super().list(path, timeout))

    def make_dir(self, path: str, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Creates a new directory and all directories along the way if needed on the specified path.

        :param path: Path to a new directory. For example '/dirA/dirB' when creating 'dirB'
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        return self._loop.run_until_complete(super().make_dir(path, timeout))

    def watch_dir(self, path: str) -> SyncFilesystemWatcher:
        """
        Watches directory for filesystem events.

        :param path: Path to a directory that will be watched

        :return: New watcher
        """
        return self._loop.run_until_complete(super().watch_dir(path))
