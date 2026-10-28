from dataclasses import dataclass
from typing import Generic, List, Optional

from typing_extensions import TypeVar

from e2b.exceptions import SandboxException

Stdout = str
"""
Command stdout output.
"""
Stderr = str
"""
Command stderr output.
"""
PtyOutput = bytes
"""
Pty output.
"""

OutputT = TypeVar("OutputT", bound=Optional[str], default=str)
"""
Type of the accumulated command output: `None` when the command was started with `retain_output=False`, `str` otherwise.
"""


def join_output(chunks: Optional[List[str]]) -> Optional[str]:
    """
    Join accumulated output chunks, or return `None` when output is not retained.
    """
    return None if chunks is None else "".join(chunks)


@dataclass
class PtySize:
    """
    Pseudo-terminal size.
    """

    rows: int
    """
    Number of rows.
    """
    cols: int
    """
    Number of columns.
    """


@dataclass
class CommandResult(Generic[OutputT]):
    """
    Command execution result.
    """

    stderr: OutputT
    """
    Command stderr output.

    `None` if the command was started with `retain_output=False`.
    """
    stdout: OutputT
    """
    Command stdout output.

    `None` if the command was started with `retain_output=False`.
    """
    exit_code: int
    """
    Command exit code.

    `0` if the command finished successfully.
    """
    error: Optional[str]
    """
    Error message from command execution if it failed.
    """


@dataclass
class CommandExitException(SandboxException, CommandResult[OutputT]):
    """
    Exception raised when a command exits with a non-zero exit code.
    """

    def __str__(self):
        if self.stderr is None:
            return f"Command exited with code {self.exit_code}"
        return f"Command exited with code {self.exit_code} and error:\n{self.stderr}"
