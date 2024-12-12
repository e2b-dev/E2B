from dataclasses import dataclass
from typing import Dict, List, Optional


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
