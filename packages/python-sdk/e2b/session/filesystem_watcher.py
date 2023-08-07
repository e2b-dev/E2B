from enum import Enum
from typing import Callable, Set, Any
from pydantic import BaseModel

from e2b.session.session_connection import SessionConnection


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
        self._rpc_subscription_id: str | None = None
        self._listeners: Set[Callable[[FilesystemEvent], Any]] = set()

    async def start(self) -> None:
        """
        Starts the filesystem watcher.
        """
        if self._rpc_subscription_id:
            return

        self._rpc_subscription_id = await self._connection._subscribe(
            self._service_name,
            self._handle_filesystem_events,
            "watchDir",
            self.path,
        )

    async def stop(self) -> None:
        """
        Stops the filesystem watcher.
        """
        self._listeners.clear()
        if self._rpc_subscription_id:
            await self._connection._unsubscribe(self._rpc_subscription_id)

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
