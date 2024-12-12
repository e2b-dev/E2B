import asyncio
import inspect

from typing import Any, AsyncGenerator, Optional

from e2b.envd.rpc import handle_rpc_exception
from e2b.envd.filesystem.filesystem_pb2 import WatchDirResponse
from e2b.sandbox.filesystem.watch_handle import FilesystemEvent, map_event_type
from e2b.sandbox_async.utils import OutputHandler


class AsyncWatchHandle:
    """
    Handle for watching a directory in the sandbox filesystem.

    Use `.stop()` to stop watching the directory.
    """

    def __init__(
        self,
        events: AsyncGenerator[WatchDirResponse, Any],
        on_event: OutputHandler[FilesystemEvent],
        on_exit: Optional[OutputHandler[Exception]] = None,
    ):
        self._events = events
        self._on_event = on_event
        self._on_exit = on_exit

        self._wait = asyncio.create_task(self._handle_events())

    async def stop(self):
        """
        Stop watching the directory.
        """
        self._wait.cancel()
        # BUG: In Python 3.8 closing async generator can throw RuntimeError.
        # await self._events.aclose()

    async def _iterate_events(self):
        try:
            async for event in self._events:
                if event.HasField("filesystem"):
                    event_type = map_event_type(event.filesystem.type)
                    if event_type:
                        yield FilesystemEvent(
                            name=event.filesystem.name,
                            type=event_type,
                        )
        except Exception as e:
            raise handle_rpc_exception(e)

    async def _handle_events(self):
        try:
            async for event in self._iterate_events():
                cb = self._on_event(event)
                if inspect.isawaitable(cb):
                    await cb
        except Exception as e:
            if self._on_exit:
                cb = self._on_exit(e)
                if inspect.isawaitable(cb):
                    await cb
