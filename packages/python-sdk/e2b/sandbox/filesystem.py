import base64
import logging
from typing import Any, List, Optional

from pydantic import BaseModel

from e2b.constants import TIMEOUT
from e2b.sandbox.exception import FilesystemException, RpcException
from e2b.sandbox.filesystem_watcher import FilesystemWatcher
from e2b.sandbox.sandbox_connection import SandboxConnection
from e2b.utils.filesystem import resolve_path

logger = logging.getLogger(__name__)


class FileInfo(BaseModel):
    """
    Information about a file or a directory in the sandbox.
    """

    is_dir: bool
    name: str


class FilesystemManager:
    """
    Manager for interacting with the filesystem in the sandbox.
    """

    _service_name = "filesystem"

    def __init__(self, sandbox: SandboxConnection):
        self._sandbox = sandbox

    @property
    def cwd(self) -> Optional[str]:
        return self._sandbox.cwd

    def read_bytes(self, path: str, timeout: Optional[float] = TIMEOUT) -> bytes:
        """
        Read the whole content of a file as a byte array.
        This can be used when you cannot represent the data as an UTF-8 string.

        :param path: path to a file
        :param timeout: timeout for the call
        :return: byte array representing the content of a file
        """
        path = resolve_path(path, self.cwd)
        result: str = self._sandbox._call(
            self._service_name, "readBase64", [path], timeout=timeout
        )
        return base64.b64decode(result)

    def write_bytes(
        self, path: str, content: bytes, timeout: Optional[float] = TIMEOUT
    ) -> None:
        """
        Write content to a file as a byte array.
        This can be used when you cannot represent the data as an UTF-8 string.

        A new file will be created if it doesn't exist.
        If the file already exists, it will be overwritten.

        :param path: path to a file
        :param timeout: timeout for the call
        :param content: byte array representing the content to write
        """
        path = resolve_path(path, self.cwd)
        base64_content = base64.b64encode(content).decode("utf-8")
        self._sandbox._call(
            self._service_name, "writeBase64", [path, base64_content], timeout=timeout
        )

    def read(self, path: str, timeout: Optional[float] = TIMEOUT) -> str:
        """
        Read the whole content of a file as an array of bytes.

        :param path: Path to a file
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        :return: Content of a file
        """
        logger.debug(f"Reading file {path}")

        path = resolve_path(path, self.cwd)
        try:
            result: str = self._sandbox._call(
                self._service_name, "read", [path], timeout=timeout
            )
            logger.debug(f"Read file {path}")
            return result
        except RpcException as e:
            raise FilesystemException(e.message) from e

    def write(
        self, path: str, content: str, timeout: Optional[float] = TIMEOUT
    ) -> None:
        """
        Write content to a file.

        A new file will be created if it doesn't exist.
        If the file already exists, it will be overwritten.

        :param path: Path to a file
        :param content: Content to write
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        logger.debug(f"Writing file {path}")

        path = resolve_path(path, self.cwd)
        try:
            self._sandbox._call(
                self._service_name, "write", [path, content], timeout=timeout
            )
            logger.debug(f"Wrote file {path}")
        except RpcException as e:
            raise FilesystemException(e.message) from e

    def remove(self, path: str, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Remove a file or a directory.

        :param path: Path to a file or a directory
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        logger.debug(f"Removing file {path}")

        path = resolve_path(path, self.cwd)
        try:
            self._sandbox._call(self._service_name, "remove", [path], timeout=timeout)
            logger.debug(f"Removed file {path}")
        except RpcException as e:
            raise FilesystemException(e.message) from e

    def list(self, path: str, timeout: Optional[float] = TIMEOUT) -> List[FileInfo]:
        """
        List files in a directory.

        :param path: Path to a directory
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time

        :return: Array of files in a directory
        """
        logger.debug(f"Listing files in {path}")

        path = resolve_path(path, self.cwd)
        try:
            result: List[Any] = self._sandbox._call(
                self._service_name, "list", [path], timeout=timeout
            )
            logger.debug(f"Listed files in {path}, result: {result}")
            return [
                FileInfo(is_dir=file_info["isDir"], name=file_info["name"])
                for file_info in result
            ]
        except RpcException as e:
            raise FilesystemException(e.message) from e

    def make_dir(self, path: str, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Create a new directory and all directories along the way if needed on the specified path.

        :param path: Path to a new directory. For example '/dirA/dirB' when creating 'dirB'
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        logger.debug(f"Creating directory {path}")

        path = resolve_path(path, self.cwd)
        try:
            self._sandbox._call(self._service_name, "makeDir", [path], timeout=timeout)
            logger.debug(f"Created directory {path}")
        except RpcException as e:
            raise FilesystemException(e.message) from e

    def watch_dir(self, path: str) -> FilesystemWatcher:
        """
        Watches directory for filesystem events.

        :param path: Path to a directory that will be watched

        :return: New watcher
        """
        logger.debug(f"Watching directory {path}")

        path = resolve_path(path, self.cwd)
        return FilesystemWatcher(
            connection=self._sandbox,
            path=path,
            service_name=self._service_name,
        )
