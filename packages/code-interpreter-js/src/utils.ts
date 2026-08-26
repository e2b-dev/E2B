import { TimeoutError } from 'e2b'

export function formatRequestTimeoutError(error: unknown) {
  if (error instanceof Error && error.name === 'AbortError') {
    return new TimeoutError(
      "Request timed out — the 'requestTimeoutMs' option can be used to increase this timeout"
    )
  }

  return error
}

export function formatExecutionTimeoutError(error: unknown) {
  if (error instanceof Error && error.name === 'AbortError') {
    return new TimeoutError(
      "Execution timed out — the 'timeoutMs' option can be used to increase this timeout"
    )
  }

  return error
}

const CONNECTION_CLOSED_CODES = ['ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET']

// Deno surfaces a mid-stream disconnect as a plain `TypeError` from hyper,
// with no `code` and no `cause` — the message is the only signal.
const CONNECTION_CLOSED_MESSAGES = [
  'error reading a body from connection',
  'connection closed before message completed',
  'connection reset by peer',
]

/**
 * Checks if the error means the connection was closed/reset while the request
 * was in flight. The shape of this error is runtime-specific — Bun sets a
 * `code` directly, Node's fetch (undici) wraps the socket error in the `cause`
 * of a generic `TypeError`, and Deno only sets a message.
 */
export function isConnectionClosedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && CONNECTION_CLOSED_CODES.includes(code)) {
    return true
  }

  if (error.name === 'ConnectionReset' || error.name === 'ConnectionClosed') {
    return true
  }

  const message = error.message.toLowerCase()
  if (CONNECTION_CLOSED_MESSAGES.some((m) => message.includes(m))) {
    return true
  }

  if (error.cause) {
    return isConnectionClosedError(error.cause)
  }

  return false
}

export async function* readLines(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (value !== undefined) {
        buffer += new TextDecoder().decode(value)
      }

      if (done) {
        if (buffer.length > 0) {
          yield buffer
        }
        break
      }

      let newlineIdx = -1

      do {
        newlineIdx = buffer.indexOf('\n')
        if (newlineIdx !== -1) {
          yield buffer.slice(0, newlineIdx)
          buffer = buffer.slice(newlineIdx + 1)
        }
      } while (newlineIdx !== -1)
    }
  } finally {
    reader.releaseLock()
  }
}
