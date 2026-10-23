import { InvalidArgumentError, SandboxError } from 'e2b'

/**
 * Default maximum size of a single message from the agent, matching the
 * TypeScript ACP SDK.
 */
export const DEFAULT_MAX_MESSAGE_BYTES = 32 * 1024 * 1024

const encoder = new TextEncoder()

/**
 * Splits newline-delimited text chunks into complete lines.
 */
export class LineSplitter {
  // Text after the last newline. Chunks are joined once, when the line ends,
  // so a long message is not rescanned on every chunk.
  private pending: string[] = []
  private pendingBytes = 0

  constructor(private readonly maxLineBytes: number) {
    if (!Number.isSafeInteger(maxLineBytes) || maxLineBytes <= 0) {
      throw new InvalidArgumentError(
        `maxMessageBytes must be a positive integer, got ${maxLineBytes}`
      )
    }
  }

  push(chunk: string): string[] {
    const lines = chunk.split('\n')
    const rest = lines.pop() ?? ''
    if (lines.length > 0) {
      this.append(lines[0])
      lines[0] = this.flush()
      for (const line of lines.slice(1)) {
        // Characters never outnumber UTF-8 bytes, so the cheap length check
        // only lets through lines that might be too large.
        if (line.length > this.maxLineBytes / 4) {
          this.check(encoder.encode(line).length)
        }
      }
    }
    this.append(rest)
    return lines
  }

  flush(): string {
    const rest = this.pending.join('')
    this.pending = []
    this.pendingBytes = 0
    return rest
  }

  private append(text: string) {
    if (text) {
      this.pending.push(text)
      this.pendingBytes += encoder.encode(text).length
      this.check(this.pendingBytes)
    }
  }

  private check(bytes: number) {
    if (bytes > this.maxLineBytes) {
      throw new SandboxError(
        `ACP message exceeds the limit of ${this.maxLineBytes} bytes. Pass a larger \`maxMessageBytes\` to connectAcpAgent() if the agent sends larger messages.`
      )
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Methods that would make the agent read files or run commands on the
 * client's machine instead of inside the sandbox.
 */
export function isClientExecutionMethod(method: unknown): boolean {
  return (
    typeof method === 'string' &&
    (method.startsWith('fs/') || method.startsWith('terminal/'))
  )
}

/**
 * Turns off the client filesystem and terminal capabilities in an
 * `initialize` request, also inside a batch, so the agent keeps using its own
 * tools in the sandbox. Other messages are returned unchanged.
 */
export function restrictClientCapabilities<T>(message: T): T {
  if (Array.isArray(message)) {
    return message.map(restrictClientCapabilities) as T
  }
  if (!isRecord(message) || message.method !== 'initialize') {
    return message
  }
  const params = isRecord(message.params) ? message.params : {}
  const capabilities = isRecord(params.clientCapabilities)
    ? params.clientCapabilities
    : {}
  return {
    ...message,
    params: {
      ...params,
      clientCapabilities: {
        ...capabilities,
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
    },
  }
}

/**
 * Splits agent output into what is forwarded to the client and the error
 * responses sent straight back to the agent for client-execution requests.
 */
export function filterAgentMessage(message: unknown): {
  forward?: unknown
  replies: unknown[]
} {
  const items = Array.isArray(message) ? message : [message]
  const forward: unknown[] = []
  const replies: unknown[] = []

  for (const item of items) {
    if (!isRecord(item) || !isClientExecutionMethod(item.method)) {
      forward.push(item)
      continue
    }
    // Notifications get no reply; requests are rejected.
    if ('id' in item) {
      replies.push({
        jsonrpc: '2.0',
        id: item.id,
        error: {
          code: -32601,
          message: `Method not found: ${item.method} is not available, the agent runs inside an E2B sandbox`,
        },
      })
    }
  }

  if (!Array.isArray(message)) {
    return { forward: forward[0], replies }
  }
  return { forward: forward.length ? forward : undefined, replies }
}

export const PARSE_ERROR_RESPONSE = {
  jsonrpc: '2.0',
  id: null,
  error: { code: -32700, message: 'Parse error' },
}
