DEFAULT_MAX_MESSAGE_BYTES = 32 * 1024 * 1024
"""
Default maximum size of a single message from the agent, the same as the
TypeScript ACP SDK uses.
"""

DEFAULT_STOP_TIMEOUT = 5
"""
Default time for an ACP agent to exit after `stop()`, in **seconds**.
"""

STDERR_TAIL_CHARS = 4096
READ_QUEUE_MESSAGES = 64

METHOD_NOT_FOUND = -32601
PARSE_ERROR = -32700

PARSE_ERROR_RESPONSE = {
    "jsonrpc": "2.0",
    "id": None,
    "error": {"code": PARSE_ERROR, "message": "Parse error"},
}
