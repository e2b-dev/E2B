from typing import Callable, List, Optional

from packaging.version import Version

from e2b import SandboxException
from e2b.connection_config import ConnectionConfig, Username
from e2b.envd.filesystem import filesystem_connect
from e2b.envd.filesystem.filesystem_pb2 import (
    GetWatcherEventsRequest,
    RemoveWatcherRequest,
)
from e2b.envd.rpc import authentication_header, handle_rpc_exception_with_health
from e2b.sandbox.filesystem.filesystem import map_entry_info
from e2b.sandbox.filesystem.watch_handle import FilesystemEvent, map_event_type


class WatchHandle:
    """
    Handle for watching filesystem events.
    It is used to get the latest events that have occurred in the watched directory.

    Use `.stop()` to stop watching the directory.
    """

    def __init__(
        self,
        get_rpc: Callable[[], filesystem_connect.FilesystemClient],
        watcher_id: str,
        connection_config: ConnectionConfig,
        envd_version: Version,
        user: Optional[Username] = None,
        check_health: Optional[Callable[[], Optional[bool]]] = None,
    ):
        self._get_rpc = get_rpc
        self._watcher_id = watcher_id
        self._connection_config = connection_config
        self._envd_version = envd_version
        self._user = user
        self._check_health = check_health
        self._closed = False

    def stop(self, request_timeout: Optional[float] = None):
        """
        Stop watching the directory.
        After you stop the watcher you won't be able to get the events anymore.

        :param request_timeout: Timeout for the request in **seconds**
        """
        try:
            self._get_rpc().remove_watcher(
                RemoveWatcherRequest(watcher_id=self._watcher_id),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, self._user),
            )
        except Exception as e:
            raise handle_rpc_exception_with_health(e, self._check_health)

        self._closed = True

    def get_new_events(
        self, request_timeout: Optional[float] = None
    ) -> List[FilesystemEvent]:
        """
        Get the latest events that have occurred in the watched directory since the last call, or from the beginning of the watching, up until now.

        :param request_timeout: Timeout for the request in **seconds**

        :return: List of filesystem events
        """
        if self._closed:
            raise SandboxException("The watcher is already stopped")

        try:
            r = self._get_rpc().get_watcher_events(
                GetWatcherEventsRequest(watcher_id=self._watcher_id),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
                headers=authentication_header(self._envd_version, self._user),
            )
        except Exception as e:
            raise handle_rpc_exception_with_health(e, self._check_health)

        events = []
        for event in r.events:
            event_type = map_event_type(event.type)
            if event_type:
                events.append(
                    FilesystemEvent(
                        name=event.name,
                        type=event_type,
                        entry=(
                            map_entry_info(event.entry)
                            if event.HasField("entry")
                            else None
                        ),
                    )
                )

        return events
