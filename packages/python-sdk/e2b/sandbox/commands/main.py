from dataclasses import dataclass
from typing import Dict, List, Optional


def kill_process_tree_command(pid: int) -> str:
    """
    Build a shell command that terminates the process ``pid`` together with all
    of its descendant processes.

    envd's ``SendSignal`` RPC only delivers a signal to the single process it
    manages, so any child processes the command spawned keep running after a
    plain ``kill`` (see https://github.com/e2b-dev/E2B/issues/1034). This walks
    the process tree with ``pgrep`` and sends ``SIGKILL`` from the leaves up so
    the whole tree is reliably stopped.

    The command prints ``1`` if ``pid`` existed (so the caller can report whether
    a process was found) or ``0`` otherwise. It degrades gracefully to killing
    just ``pid`` if ``pgrep`` is unavailable in the sandbox.
    """
    return (
        "__e2b_kill_tree() { "
        "local child; "
        'for child in $(pgrep -P "$1" 2>/dev/null); do __e2b_kill_tree "$child"; done; '
        'kill -KILL "$1" 2>/dev/null || true; '
        "}; "
        f"if kill -0 {pid} 2>/dev/null; then __e2b_found=1; else __e2b_found=0; fi; "
        f"__e2b_kill_tree {pid}; "
        'echo "$__e2b_found"'
    )


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
