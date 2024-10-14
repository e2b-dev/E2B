from typing import List

from e2b import SandboxException
from e2b.envd.filesystem import filesystem_connect
from e2b.envd.filesystem.filesystem_pb2 import WatchDirStopRequest, WatchDirGetRequest
from e2b.envd.rpc import handle_rpc_exception
from e2b.sandbox.filesystem.watch_handle import FilesystemEvent, map_event_type


class WatchHandle:
    """
    Handle for watching filesystem events. It is used to iterate over the events in the watched directory.
    """

    def __init__(
        self,
        rpc: filesystem_connect.FilesystemClient,
        watcher_id: str,
    ):
        self._rpc = rpc
        self._watcher_id = watcher_id
        self._closed = False

    def close(self):
        """
        Stop watching the directory. After you close the watcher you won't be able to get the events anymore.
        """
        try:
            self._rpc.watch_dir_stop(WatchDirStopRequest(watcherId=self._watcher_id))
        except Exception as e:
            raise handle_rpc_exception(e)

        self._closed = True

    def get(self, offset: int = 0) -> List[FilesystemEvent]:
        """
        Get the events that occurred in the watched directory till now.
        If you are calling it multiple times, you can pass the offset to get the new events only.
        """
        if self._closed:
            raise SandboxException("The watcher is already closed")

        try:
            r = self._rpc.watch_dir_get(
                WatchDirGetRequest(
                    watcher_id=self._watcher_id,
                    offset=offset,
                )
            )
        except Exception as e:
            raise handle_rpc_exception(e)

        events = []
        for event in r.events:
            event_type = map_event_type(event.type)
            if event_type:
                events.append(
                    FilesystemEvent(
                        name=event.name,
                        type=event_type,
                    )
                )

        return events
