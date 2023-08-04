import asyncio
import json

from concurrent.futures import Future
from typing import TypeVar, Generic, Any, List

T = TypeVar("T")


class DeferredFuture(Generic[T]):
    def __init__(self):
        self.future = asyncio.Future[T]()

    def __call__(self, result: T):
        if not self.future.done():
            self.future.set_result(result)

    def __await__(self):
        yield from self.future.__await__()

    def reject(self, reason: Any):
        if not self.future.done():
            self.future.set_exception(reason)


def format_settled_errors(settled: List[str | Exception | None]):
    if all(not s is Exception is None for s in settled):
        return None

    errors = "errors:\n"
    for i, s in enumerate(settled):
        if s is Exception:
            errors += f"\n[{i}]: {json.dumps(s.exception().__str__())}"

    return errors
