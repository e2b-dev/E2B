from typing import Any, Generator
from e2b.exceptions import handle_rpc_exception

from e2b.envd.filesystem.filesystem_pb2 import WatchDirResponse

# TODO: Export custom types


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
                    yield event.filesystem
        except Exception as e:
            raise handle_rpc_exception(e)
        finally:
            self.close()
