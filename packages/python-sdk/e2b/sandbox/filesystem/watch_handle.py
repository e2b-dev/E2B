from typing import Any, Generator
from dataclasses import dataclass
from enum import Enum

from e2b.envd.rpc import handle_rpc_exception
from e2b.envd.filesystem.filesystem_pb2 import EventType, WatchDirResponse


class FilesystemEventType(Enum):
    CHMOD = "chmod"
    CREATE = "create"
    REMOVE = "remove"
    RENAME = "rename"
    WRITE = "write"


def map_event_type(event: EventType):
    if event == EventType.EVENT_TYPE_CHMOD:
        return FilesystemEventType.CHMOD
    elif event == EventType.EVENT_TYPE_CREATE:
        return FilesystemEventType.CREATE
    elif event == EventType.EVENT_TYPE_REMOVE:
        return FilesystemEventType.REMOVE
    elif event == EventType.EVENT_TYPE_RENAME:
        return FilesystemEventType.RENAME
    elif event == EventType.EVENT_TYPE_WRITE:
        return FilesystemEventType.WRITE


@dataclass
class FilesystemEvent:
    name: str
    type: FilesystemEventType


class WatchHandle:
    def __init__(
        self,
        events: Generator[WatchDirResponse, Any, None],
    ):
        self._events = events

    def __iter__(self):
        return self._handle_events()

    def close(self):
        self._events.close()

    def _handle_events(self):
        try:
            for event in self._events:
                if event.HasField("filesystem"):
                    event_type = map_event_type(event.filesystem.type)
                    if event_type:
                        yield FilesystemEvent(
                            name=event.filesystem.name,
                            type=event_type,
                        )
        except Exception as e:
            raise handle_rpc_exception(e)
        finally:
            self.close()
