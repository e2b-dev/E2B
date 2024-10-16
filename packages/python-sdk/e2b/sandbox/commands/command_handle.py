from dataclasses import dataclass
from typing import Optional

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
class CommandResult:
    """
    Command execution result.
    """

    stderr: str
    """
    Command stderr output.
    """
    stdout: str
    """
    Command stdout output.
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
class CommandExitException(SandboxException, CommandResult):
    """
    Exception raised when a command exits with a non-zero exit code.
    """

    def __str__(self):
        return f"Command exited with code {self.exit_code} and error:\n{self.stderr}"
