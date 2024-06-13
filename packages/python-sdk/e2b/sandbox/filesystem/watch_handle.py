from typing import Any, Generator

from e2b.envd.filesystem.filesystem_pb2 import WatchDirResponse


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
                yield event.event
        finally:
            self.close()
