/**
 * Default maximum size of a single message from the agent, matching the
 * TypeScript ACP SDK.
 */
export const DEFAULT_MAX_MESSAGE_BYTES = 32 * 1024 * 1024

/**
 * Default time for an ACP agent to exit after `stop()`, in **milliseconds**.
 */
export const DEFAULT_STOP_TIMEOUT_MS = 5_000

export const STDERR_TAIL_CHARS = 4096
export const READ_QUEUE_MESSAGES = 64

export const METHOD_NOT_FOUND = -32601
export const PARSE_ERROR = -32700

export const PARSE_ERROR_RESPONSE = {
  jsonrpc: '2.0',
  id: null,
  error: { code: PARSE_ERROR, message: 'Parse error' },
}
