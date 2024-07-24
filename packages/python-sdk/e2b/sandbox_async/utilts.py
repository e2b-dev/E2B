from typing import TypeVar, Union, Callable, Awaitable

T = TypeVar("T")
OutputHandler = Union[
    Callable[[T], None],
    Callable[[T], Awaitable[None]],
]
