import asyncio
import json

from typing import TypeVar, Generic, List

T = TypeVar("T")


class DeferredFuture(Generic[T]):
    def __init__(self):
        self.future = asyncio.Future[T]()

    def __call__(self, result: T):
        if not self.future.done():
            self.future.set_result(result)

    def __await__(self):
        result = yield from self.future.__await__()
        return result

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
