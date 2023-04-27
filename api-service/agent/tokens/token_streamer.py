from asyncio import Queue


class TokenStreamer:
    def __init__(self) -> None:
        self._queue: Queue[str | None] = Queue(1)

    async def retrieve(self):
        token = await self._queue.get()
        self._queue.task_done()
        return token

    async def ingest(self, token: str):
        await self._queue.put(token)

    async def close(self):
        await self._queue.put(None)
