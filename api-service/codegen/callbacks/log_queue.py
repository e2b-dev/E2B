from asyncio import Queue, ensure_future, sleep
from typing import Coroutine


class LogQueue:
    def __init__(self) -> None:
        self._queue: Queue[Coroutine] = Queue()
        # Start the worker that saves logs from queue to the db.
        self._worker = ensure_future(self._start())

    async def _work(self):
        # Remove all logs except the newest one from the queue.
        for _ in range(self._queue.qsize() - 1):
            old_coro = self._queue.get_nowait()
            try:
                old_coro.close()
            except Exception as e:
                print(e)
            finally:
                self._queue.task_done()

        # Save the newest log to the db or wait until a log is pushed to the queue and then save it to the db.
        task = await self._queue.get()
        try:
            await ensure_future(task)
        except Exception as e:
            print(e)
        finally:
            self._queue.task_done()

    async def _start(self):
        while True:
            await self._work()

    async def flush(self):
        await self._queue.join()

    def add(self, log: Coroutine):
        self._queue.put_nowait(log)

    def close(self):
        self._worker.cancel()
