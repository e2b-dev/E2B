import json
import math
from typing import Any, Dict, List, Tuple

from e2b import InvalidArgumentException, SandboxException

JsonRpcMessage = Dict[str, Any]
"""
JSON-RPC 2.0 message exchanged with an ACP agent.
"""

DEFAULT_MAX_MESSAGE_BYTES = 32 * 1024 * 1024
"""
Default maximum size of a single message from the agent, the same as the
TypeScript ACP SDK uses.
"""

PARSE_ERROR_RESPONSE: JsonRpcMessage = {
    "jsonrpc": "2.0",
    "id": None,
    "error": {"code": -32700, "message": "Parse error"},
}


class LineSplitter:
    """
    Splits newline-delimited text chunks into complete lines.
    """

    def __init__(self, max_line_bytes: int):
        if (
            isinstance(max_line_bytes, bool)
            or not isinstance(max_line_bytes, (int, float))
            or not math.isfinite(max_line_bytes)
            or max_line_bytes != int(max_line_bytes)
            or max_line_bytes <= 0
        ):
            raise InvalidArgumentException(
                f"max_message_bytes must be a positive integer, got {max_line_bytes}"
            )
        self._max_line_bytes = int(max_line_bytes)
        self._pending = ""

    def push(self, chunk: str) -> List[str]:
        parts = (self._pending + chunk).split("\n")
        self._pending = parts.pop()
        # Characters never outnumber UTF-8 bytes, so the cheap length check
        # only lets through lines that might be too large.
        for line in [*parts, self._pending]:
            if (
                len(line) > self._max_line_bytes / 4
                and len(line.encode()) > self._max_line_bytes
            ):
                raise SandboxException(
                    f"ACP message exceeds the limit of {self._max_line_bytes} bytes"
                )
        return parts

    def flush(self) -> str:
        rest, self._pending = self._pending, ""
        return rest


def encode_message(message: Any) -> str:
    return json.dumps(message, separators=(",", ":"), ensure_ascii=False) + "\n"


def is_client_execution_method(method: Any) -> bool:
    """
    Methods that would make the agent read files or run commands on the
    client's machine instead of inside the sandbox.
    """
    return isinstance(method, str) and (
        method.startswith("fs/") or method.startswith("terminal/")
    )


def restrict_client_capabilities(message: Any) -> Any:
    """
    Turn off the client filesystem and terminal capabilities in an
    `initialize` request, also inside a batch, so the agent keeps using its
    own tools in the sandbox. Other messages are returned unchanged.
    """
    if isinstance(message, list):
        return [restrict_client_capabilities(item) for item in message]
    if not isinstance(message, dict) or message.get("method") != "initialize":
        return message
    params = message.get("params")
    params = params if isinstance(params, dict) else {}
    capabilities = params.get("clientCapabilities")
    capabilities = capabilities if isinstance(capabilities, dict) else {}
    return {
        **message,
        "params": {
            **params,
            "clientCapabilities": {
                **capabilities,
                "fs": {"readTextFile": False, "writeTextFile": False},
                "terminal": False,
            },
        },
    }


def filter_agent_message(message: Any) -> Tuple[Any, List[JsonRpcMessage]]:
    """
    Split agent output into what is forwarded to the client (`None` if
    nothing) and the error responses sent straight back to the agent for
    client-execution requests.
    """
    items = message if isinstance(message, list) else [message]
    forward: List[Any] = []
    replies: List[JsonRpcMessage] = []

    for item in items:
        if not isinstance(item, dict) or not is_client_execution_method(
            item.get("method")
        ):
            forward.append(item)
            continue
        # Notifications get no reply; requests are rejected.
        if "id" in item:
            replies.append(
                {
                    "jsonrpc": "2.0",
                    "id": item["id"],
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {item['method']} is not available, the agent runs inside an E2B sandbox",
                    },
                }
            )

    if not isinstance(message, list):
        return (forward[0] if forward else None), replies
    return (forward or None), replies


def parse_agent_line(line: str) -> Tuple[Any, List[JsonRpcMessage]]:
    """
    Parse one line of agent output into the message to forward to the client
    and the replies to send back to the agent.
    """
    text = line.strip()
    if not text:
        return None, []
    try:
        message = json.loads(text)
    except ValueError:
        return None, [PARSE_ERROR_RESPONSE]
    return filter_agent_message(message)
