from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from e2b.exceptions import InvalidArgumentException


@dataclass
class ProcessInfo:
    """
    Information about a command, PTY session or start command running in the sandbox as process.
    """

    pid: int
    """
    Process ID.
    """

    tag: Optional[str]
    """
    Custom tag used for identifying special commands like start command in the custom template.
    """

    cmd: str
    """
    Command that was executed.
    """

    args: List[str]
    """
    Command arguments.
    """

    envs: Dict[str, str]
    """
    Environment variables used for the command.
    """

    cwd: Optional[str]
    """
    Executed command working directory.
    """


DEFAULT_SHELL = ["/bin/bash", "-l", "-c"]


def shell_command(shell: Optional[Sequence[str]], cmd: str) -> Tuple[str, List[str]]:
    """
    Split `shell` into the executable and its arguments, with `cmd` appended as the last argument.
    """
    if shell is None:
        shell = DEFAULT_SHELL
    if (
        isinstance(shell, str)
        or not isinstance(shell, Sequence)
        or not shell
        or not shell[0]
    ):
        raise InvalidArgumentException(
            '`shell` must start with the executable, e.g. `["/bin/sh", "-c"]`. Omit `shell` to use the default `["/bin/bash", "-l", "-c"]`.'
        )
    return shell[0], [*shell[1:], cmd]
