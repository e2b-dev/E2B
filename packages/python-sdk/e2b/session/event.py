from janus import Queue


class Event:
    _is_set = False

    def __init__(self):
        self._queue = Queue[bool](1)

    async def wait(self):
        if self._is_set:
            return True
        await self._queue.async_q.get()
        self._queue.async_q.task_done()
        self._is_set = True

    def is_set(self):
        return self._is_set or self._queue.async_q.qsize() > 0

    def set(self):
        self._queue.sync_q.put(True)
