from enum import Enum
from typing import Callable, Set, Optional
from pydantic import BaseModel, PrivateAttr

from e2b_sdk.session.session_connection import SessionConnection
from e2b_sdk.session.filesystem import FilesystemManager


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
    # Unix epoch in nanoseconds
    timestamp: int
    is_dir: bool


FilesystemEventListener = Callable[[FilesystemEvent], None]


class FilesystemWatcher(BaseModel):
    _listeners: Set[FilesystemEventListener] = PrivateAttr(set())
    _rpc_subscription_id: Optional[str] = PrivateAttr(None)

    path: str
    session_connection: SessionConnection

    async def start(self) -> None:
        if self._rpc_subscription_id:
            return

        self._rpc_subscription_id = await self.session_connection.subscribe(
            FilesystemManager.service_name,
            self._handle_filesystem_events,
            "watchDir",
            self.path,
        )

    async def stop(self) -> None:
        self._listeners.clear()
        if self._rpc_subscription_id:
            await self.session_connection.unsubscribe(self._rpc_subscription_id)

    def add_event_listener(self, listener: FilesystemEventListener):
        self._listeners.add(listener)

        def delete_listener() -> None:
            self._listeners.remove(listener)

        return delete_listener

    def _handle_filesystem_events(self, event: FilesystemEvent) -> None:
        for listener in self._listeners:
            listener(event)
