from asyncio import Queue, ensure_future, sleep
from typing import Coroutine


class LogQueue:
    def __init__(self, sleep_time=0.15) -> None:
        self.queue: Queue[Coroutine] = Queue()
        self.work = ensure_future(self.worker())
        self.sleep_time = sleep_time

    async def worker(self):
        while True:
            for _ in range(self.queue.qsize() - 1):
                old_coro = self.queue.get_nowait()
                try:
                    old_coro.close()
                except Exception as e:
                    print(e)

            task = await self.queue.get()
            try:
                await ensure_future(task)
                self.queue.task_done()
            except Exception as e:
                print(e)

    def close(self):
        self.work.cancel()
