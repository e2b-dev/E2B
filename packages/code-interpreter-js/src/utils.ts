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

// Deno (hyper) and workerd surface a mid-stream disconnect as a plain error
// with no `code` and no `cause` — the message is the only signal.
const CONNECTION_CLOSED_MESSAGES = [
  'error reading a body from connection',
  'connection closed before message completed',
  'connection reset by peer',
  'network connection lost',
]

/**
 * Checks if the error means the connection was closed/reset while the request
 * was in flight. The shape of this error is runtime-specific — Bun sets a
 * `code` directly, Node's fetch (undici) wraps the socket error in the `cause`
 * of a generic `TypeError`, and Deno and workerd only set a message.
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
  const decoder = new TextDecoder()
  // Fragments of the line currently being assembled. Kept as an array so a
  // long line (e.g. a base64 image or a wide DataFrame with no newlines) is
  // joined once per emitted line instead of being re-copied on every chunk,
  // which kept this generator O(n^2) in line length.
  const fragments: string[] = []

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (value !== undefined) {
        // Decode only the new chunk: TextDecoder in streaming mode already
        // carries over incomplete multi-byte sequences across chunks.
        const text = decoder.decode(value, { stream: true })
        let start = 0
        let newlineIdx = text.indexOf('\n', start)
        while (newlineIdx !== -1) {
          fragments.push(text.slice(start, newlineIdx))
          yield fragments.join('')
          fragments.length = 0
          start = newlineIdx + 1
          newlineIdx = text.indexOf('\n', start)
        }
        if (start < text.length) {
          fragments.push(text.slice(start))
        }
      }

      if (done) {
        const trailing = decoder.decode()
        if (trailing.length > 0) {
          fragments.push(trailing)
        }
        if (fragments.length > 0) {
          yield fragments.join('')
        }
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
}
