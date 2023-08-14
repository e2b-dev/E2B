from enum import Enum
from typing import Callable, Set, Any, Awaitable, Optional
from pydantic import BaseModel

from e2b.session.session_connection import SessionConnection
from e2b.session.exception import FilesystemException
from e2b.session.session_rpc import RpcException


class FilesystemOperation(str, Enum):
    Create = "Create"
    Write = "Write"
    Remove = "Remove"
    Rename = "Rename"
    Chmod = "Chmod"


class FilesystemEvent(BaseModel):
    path: str
    name: str
    operation: FilesystemOperation
    timestamp: int
    """
    Unix epoch in nanoseconds
    """
    is_dir: bool


class FilesystemWatcher:
    @property
    def path(self) -> str:
        """
        The path to watch.
        """
        return self._path

    def __init__(
        self,
        connection: SessionConnection,
        path: str,
        service_name: str,
    ):
        self._connection = connection
        self._path = path
        self._service_name = service_name
        self._unsubscribe: Optional[Callable[[], Awaitable[Any]]] = None
        self._listeners: Set[Callable[[FilesystemEvent], Any]] = set()

    async def start(self) -> None:
        """
        Starts the filesystem watcher.
        """
        if self._unsubscribe:
            return

        try:
            self._unsubscribe = await self._connection._subscribe(
                self._service_name,
                self._handle_filesystem_events,
                "watchDir",
                self.path,
            )
        except RpcException as e:
            raise FilesystemException(e.message) from e

    async def stop(self) -> None:
        """
        Stops the filesystem watcher.
        """
        self._listeners.clear()
        if self._unsubscribe:
            try:
                await self._unsubscribe()
                self._unsubscribe = None
            except RpcException as e:
                raise FilesystemException(e.message) from e

    def add_event_listener(self, listener: Callable[[FilesystemEvent], Any]):
        """
        Adds a listener for filesystem events.

        :param listener: a listener to add

        :return: a function that removes the listener
        """
        self._listeners.add(listener)

        def delete_listener() -> None:
            self._listeners.remove(listener)

        return delete_listener

    def _handle_filesystem_events(self, event: FilesystemEvent) -> None:
        for listener in self._listeners:
            listener(event)
