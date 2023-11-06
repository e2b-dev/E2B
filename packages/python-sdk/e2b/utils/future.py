import asyncio
from asyncio import AbstractEventLoop

from concurrent.futures import Future
from typing import Any, Awaitable, Callable, Generic, List, Optional, TypeVar

T = TypeVar("T")


# Check if using event is not better for most use cases
class DeferredFuture(Generic[T]):
    def __init__(self, cleanup_list: Optional[List[Callable[[], Any]]] = None):
        self._future = Future()
        if cleanup_list is not None:
            cleanup_list.append(self.cancel)

    def __call__(self, result: T):
        if not self._future.done():
            self._future.set_result(result)

    def result(self, timeout: Optional[float] = None) -> T:
        return self._future.result(timeout=timeout)

    def done(self) -> bool:
        return self._future.done()

    def cancel(self):
        if not self._future.done():
            self._future.cancel()

    def reject(self, reason: Exception):
        if not self._future.done():
            self._future.set_exception(reason)


def run_async_func_in_loop(loop: AbstractEventLoop, coro: Awaitable):
    asyncio.set_event_loop(loop)

    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
