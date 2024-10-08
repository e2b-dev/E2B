from typing import Any, Generator

from e2b.envd.rpc import handle_rpc_exception
from e2b.envd.filesystem.filesystem_pb2 import EventType, WatchDirResponse
from e2b.sandbox.filesystem.watch_handle import FilesystemEvent, map_event_type


class WatchHandle:
    """
    Handle for watching filesystem events. It is used to iterate over the events in the watched directory.
    """

    def __init__(
        self,
        events: Generator[WatchDirResponse, Any, None],
    ):
        self._events = events

    def __iter__(self):
        return self._handle_events()

    def close(self):
        """
        Stop watching the directory.

        Warning:
            You won't get any event if you don't iterate over the handle before closing it.
        """
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
