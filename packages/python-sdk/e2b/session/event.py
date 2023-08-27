from janus import Queue


class Event:
    def __init__(self):
        self._queue = Queue[bool](1)

    async def wait(self):
        await self._queue.async_q.get()

    def is_set(self):
        return not self._queue.async_q.empty()

    def set(self):
        self._queue.sync_q.put(True)
