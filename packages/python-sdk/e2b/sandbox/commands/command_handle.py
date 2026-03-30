import logging

from dataclasses import dataclass, field
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
class CommandUsage:
    """
    Resource usage statistics for a command execution.
    """

    cpu_seconds: float
    """
    Total CPU time consumed by the command in seconds.
    """
    memory_mb_max: float
    """
    Peak memory usage of the command in megabytes.
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
    usage: Optional[CommandUsage] = field(default=None)
    """
    Resource usage statistics for the command.

    Contains `cpu_seconds` and `memory_mb_max` when available from the sandbox runtime.
    `None` if the sandbox runtime does not support usage reporting.
    """


@dataclass
class CommandExitException(SandboxException, CommandResult):
    """
    Exception raised when a command exits with a non-zero exit code.
    """

    def __str__(self):
        return f"Command exited with code {self.exit_code} and error:\n{self.stderr}"


def _parse_usage(end_event) -> Optional[CommandUsage]:
    """
    Parse resource usage from a protobuf EndEvent if available.

    Returns None if the sandbox runtime does not provide usage data.
    """
    try:
        if hasattr(end_event, "cpu_seconds") and hasattr(end_event, "memory_mb_max"):
            cpu = end_event.cpu_seconds
            mem = end_event.memory_mb_max
            if cpu != 0.0 or mem != 0.0:
                return CommandUsage(
                    cpu_seconds=float(cpu),
                    memory_mb_max=float(mem),
                )
    except Exception as e:
        logging.getLogger(__name__).debug("Failed to parse usage from end event: %s", e)
    return None
