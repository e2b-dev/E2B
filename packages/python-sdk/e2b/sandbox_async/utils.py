from collections.abc import Awaitable
from typing import Callable, TypeVar, Union

T = TypeVar("T")
OutputHandler = Union[
    Callable[[T], None],
    Callable[[T], Awaitable[None]],
]
