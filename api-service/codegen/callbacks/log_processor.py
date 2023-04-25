from typing import Any, Callable, Coroutine, Generic, TypeVar
from pydantic import BaseModel, PrivateAttr

from codegen.callbacks.log_queue import LogQueue

T = TypeVar("T")
OnLogs = Callable[[T], Coroutine[Any, Any, Any]]


class LogProcessor(Generic[T]):
    def __init__(self, on_logs: OnLogs[T]) -> None:
        super().__init__()
        self._on_logs = on_logs
        self.log_queue = LogQueue()

    def ingest(self, logs: T):
        task = self._on_logs(logs)
        self.log_queue.add(task)

    async def flush(self):
        await self.log_queue.flush()

    def close(self):
        self.log_queue.close()
