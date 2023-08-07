import asyncio
import json

from typing import TypeVar, Generic, List, Callable, Any

T = TypeVar("T")


class DeferredFuture(Generic[T]):
    def __init__(self, cleanup_list: List[Callable[[], Any]] | None = None):
        self.future = asyncio.Future[T]()
        if cleanup_list is not None:
            cleanup_list.append(self.future.cancel)

    def __call__(self, result: T):
        if not self.future.done():
            self.future.set_result(result)

    def __await__(self):
        result = yield from self.future.__await__()
        return result

    def cancel(self):
        if not self.future.done():
            self.future.cancel()

    def reject(self, reason: Exception):
        if not self.future.done():
            self.future.set_exception(reason)


def format_settled_errors(settled: List[str | Exception | None]):
    if all(s is not Exception for s in settled if s is not None):
        return None

    errors = "errors:\n"
    for i, s in enumerate(settled):
        if s is Exception:
            errors += f"\n[{i}]: {json.dumps(s.exception().__str__())}"

    return errors
