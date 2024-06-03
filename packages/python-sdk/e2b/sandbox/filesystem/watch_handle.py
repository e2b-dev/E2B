from typing import Any, Generator

from envd.filesystem.filesystem_pb2 import WatchResponse


class WatchHandle(Generator):
    def __init__(
        self,
        events: Generator[WatchResponse, Any, None],
    ):
        self._events = events

    def __next__(self):
        event = next(self._events)
        return event.event

    def __iter__(self):
        return self
