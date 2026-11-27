"""
Checks for arguments the server never gets to judge: the SDK turns them into a
URL, a deadline, a shell word or a request field of its own before anything is
sent, so a bad value would act as a different one instead of being refused.
What the API can check for itself is left to the API.
"""

import math

from typing import Any, Iterable, List, Mapping, Optional

from e2b.exceptions import InvalidArgumentException


def _show(value: Any) -> str:
    if isinstance(value, (str, int, float)) and not isinstance(value, bool):
        return repr(value)

    return type(value).__name__


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def resolve_timeout(timeout: Optional[float], name: str) -> Optional[float]:
    """
    Check a timeout in seconds that becomes a request timeout or an RPC
    deadline. ``0`` disables the timeout and so does infinity, which is
    returned as ``0``.
    """
    if timeout is None:
        return None

    if not _is_number(timeout) or math.isnan(timeout) or timeout < 0:
        raise InvalidArgumentException(
            f"Invalid {name}={_show(timeout)}: expected a non-negative number of "
            "seconds, or 0 to disable the timeout."
        )

    return 0 if math.isinf(timeout) else timeout


def assert_integer(value: Any, name: str, minimum: int, maximum: int) -> None:
    """Check that a value is an integer in ``[minimum, maximum]``."""
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or value < minimum
        or value > maximum
    ):
        raise InvalidArgumentException(
            f"Invalid {name}={_show(value)}: expected an integer between "
            f"{minimum} and {maximum}."
        )


def assert_pid(pid: Any) -> None:
    """Check a process ID. envd takes it as an unsigned 32-bit integer."""
    assert_integer(pid, "pid", 0, 2**32 - 1)


def assert_pty_size(cols: Any, rows: Any) -> None:
    """
    Check a PTY size. envd holds each side in 16 bits, so a larger one would
    wrap around.
    """
    assert_integer(cols, "cols", 1, 2**16 - 1)
    assert_integer(rows, "rows", 1, 2**16 - 1)


def assert_path_segment(value: Any, name: str) -> None:
    """
    Check a value that becomes one segment of a request path. An empty segment
    or a dot segment does not stay where it is put: the URL collapses onto a
    different route.
    """
    if not isinstance(value, str) or value in ("", ".", ".."):
        raise InvalidArgumentException(
            f"Invalid {name} {_show(value)}: expected a non-empty string other "
            "than '.' and '..'."
        )


def assert_non_empty_path(path: Any, name: str) -> None:
    """
    Check a sandbox file path that must name something. envd reads an empty
    path as the user's home directory.
    """
    if not isinstance(path, str) or path == "":
        raise InvalidArgumentException(
            f"Invalid {name} {_show(path)}: expected a non-empty path. An empty "
            "path stands for the user's home directory."
        )


def assert_string_values(mapping: Optional[Mapping[str, Any]], name: str) -> None:
    """
    Check that every value of a string map is a string, so that one read from
    an unset environment variable (``None``) is named before the request.
    """
    for key, value in (mapping or {}).items():
        if not isinstance(value, str):
            raise InvalidArgumentException(
                f"Invalid {name}[{key!r}]: expected a string, got "
                f"{type(value).__name__}."
            )


def to_string_list(value: Any, name: str) -> List[str]:
    """
    Read a value as a list of strings. A string is itself iterable, one
    character at a time, so it is refused and not read as a list of one.
    """
    if isinstance(value, (str, bytes, Mapping)) or not isinstance(value, Iterable):
        raise InvalidArgumentException(
            f"Invalid {name}: expected a list of strings, got {type(value).__name__}."
        )

    items = list(value)
    if any(not isinstance(item, str) for item in items):
        raise InvalidArgumentException(
            f"Invalid {name}: expected a list of strings, got a list with other values."
        )

    return items
