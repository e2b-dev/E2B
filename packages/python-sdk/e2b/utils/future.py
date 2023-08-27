import asyncio
from typing import Any, Awaitable, Callable, Generic, List, Optional, TypeVar

T = TypeVar("T")


# Check if using event is not better for most use cases
class DeferredFuture(Generic[T]):
    def __init__(self, cleanup_list: Optional[List[Callable[[], Any]]] = None):
        self._future = asyncio.Future()
        if cleanup_list is not None:
            cleanup_list.append(self.cancel)

    def __call__(self, result: T):
        if not self._future.done():
            self._future.set_result(result)

    def __await__(self):
        result = yield from self._future.__await__()
        return result

    def cancel(self):
        if not self._future.done():
            self._future.cancel()

    def reject(self, reason: Exception):
        if not self._future.done():
            self._future.set_exception(reason)


def run_async_func_in_new_loop(coro: Awaitable):
    # Create a new loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
