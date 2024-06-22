from typing import Any, Generator
from dataclasses import dataclass
from enum import Enum

from e2b.envd.rpc import handle_rpc_exception
from e2b.envd.filesystem.filesystem_pb2 import WatchDirResponse


class FilesystemEventType(Enum):
    CHMOD = "chmod"
    CREATE = "create"
    REMOVE = "remove"
    RENAME = "rename"
    WRITE = "write"


@dataclass
class FilesystemEvent:
    name: str
    type: FilesystemEventType


class WatchHandle(Generator):
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
                    yield FilesystemEvent(
                        name=event.filesystem.name,
                        type=FilesystemEventType(event.filesystem.type),
                    )
        except Exception as e:
            raise handle_rpc_exception(e)
        finally:
            self.close()
