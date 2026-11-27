"""Run one test against the sync and the async flavour of the SDK."""

import inspect

from dataclasses import dataclass
from typing import Any


@dataclass
class Sdk:
    """The sync or the async flavour of the public classes."""

    is_async: bool
    Sandbox: Any
    Template: Any
    Volume: Any


async def result(value: Any) -> Any:
    """The outcome of an SDK call of either flavour: awaited when it is async."""
    return await value if inspect.isawaitable(value) else value
