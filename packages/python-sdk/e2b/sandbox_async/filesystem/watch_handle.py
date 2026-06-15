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

        Re-raises exceptions raised by the `on_exit` callback, if any.
        """
        self._wait.cancel()
        try:
            await self._wait
        except asyncio.CancelledError:
            pass
        finally:
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

    async def _handle_events(self):
        error: Optional[Exception] = None
        try:
            async for event in self._iterate_events():
                cb = self._on_event(event)
                if inspect.isawaitable(cb):
                    await cb
        except asyncio.CancelledError:
            # Stopping the watch cancels this task — report it as a clean exit.
            pass
        except Exception as e:
            error = e

        if self._on_exit:
            cb = self._on_exit(error)
            if inspect.isawaitable(cb):
                await cb
