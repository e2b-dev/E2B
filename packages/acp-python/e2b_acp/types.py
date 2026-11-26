from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Optional, Union

JsonRpcMessage = Dict[str, Any]
"""
JSON-RPC 2.0 message exchanged with an ACP agent.
"""

StderrHandler = Union[Callable[[str], None], Callable[[str], Awaitable[None]]]


@dataclass
class ACPAgentResult:
    """
    Exit status of an ACP agent process.
    """

    exit_code: int
    """
    Exit code of the agent process.
    """
    error: Optional[str] = None
    """
    Error message if the process failed.
    """
