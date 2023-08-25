import asyncio

from janus import Queue

class _Event(asyncio.Event):
    # TODO: clear() method
    def set(self):
        # FIXME: The _loop attribute is not documented as public api!
        self._loop.call_soon_threadsafe(super().set)


class Event:
    def __init__(self):
        self._queue = Queue[bool](1)

    async def wait(self):
        await self._queue.async_q.get()

    def set(self):
        self._queue.sync_q.put(True)
