import asyncio
import inspect

from typing import Any, AsyncGenerator, Awaitable, Callable, Optional

from e2b.envd.rpc import ahandle_rpc_exception_with_health
from e2b.envd.filesystem.filesystem_pb2 import WatchDirResponse
from e2b.sandbox.filesystem.filesystem import map_entry_info
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
        on_exit: Optional[OutputHandler[Optional[Exception]]] = None,
        check_health: Optional[Callable[[], Awaitable[Optional[bool]]]] = None,
    ):
        self._events = events
        self._on_event = on_event
        self._on_exit = on_exit
        self._check_health = check_health

        self._wait = asyncio.create_task(self._handle_events())

    async def stop(self):
        """
        Stop watching the directory.
        """
        self._wait.cancel()
        await asyncio.wait([self._wait])
        try:
            await self._events.aclose()
        except Exception:
            pass

    async def _iterate_events(self):
        try:
            async for event in self._events:
                if event.HasField("filesystem"):
                    event_type = map_event_type(event.filesystem.type)
                    if event_type:
                        yield FilesystemEvent(
                            name=event.filesystem.name,
                            type=event_type,
                            entry=(
                                map_entry_info(event.filesystem.entry)
                                if event.filesystem.HasField("entry")
                                else None
                            ),
                        )
        except Exception as e:
            raise await ahandle_rpc_exception_with_health(e, self._check_health)

    async def _call_on_exit(self, error: Optional[Exception]):
        if self._on_exit is None:
            return
        try:
            cb = self._on_exit(error)
            if inspect.isawaitable(cb):
                await cb
        except Exception:
            # `on_exit` is the terminal callback; an error it raises has nowhere
            # to propagate in this background task, so it's swallowed to avoid an
            # "Task exception was never retrieved" warning. A `CancelledError`
            # (a `BaseException`) is intentionally not caught here.
            pass

    async def _handle_events(self):
        error: Optional[Exception] = None
        try:
            async for event in self._iterate_events():
                cb = self._on_event(event)
                if inspect.isawaitable(cb):
                    await cb
        except asyncio.CancelledError:
            # `stop()` cancels this task to end the watch. Treat it as a clean,
            # user-initiated end: fire `on_exit` (with no error), then propagate
            # the cancellation so the task still finishes as cancelled.
            await self._call_on_exit(None)
            raise
        except Exception as e:
            error = e

        # `on_exit` fires exactly once when the watch ends — with the error when
        # the stream failed, or with `None` on a clean end. This matches the JS
        # SDK, which calls `onExit()` after the loop completes and `onExit(err)`
        # on error.
        await self._call_on_exit(error)
