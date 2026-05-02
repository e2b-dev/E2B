import { dynamicRequire, runtime } from '../utils'

const MAX_CONCURRENT_STREAMS = 80

type Http2 = typeof import('node:http2')
type ClientHttp2Session = import('node:http2').ClientHttp2Session

class NodeHttp2Fetch {
  private readonly http2: Http2
  private readonly sessions = new Map<string, ClientHttp2Session>()
  private readonly activeStreams = new Map<string, number>()
  private readonly streamWaiters = new Map<string, Array<() => void>>()

  constructor(http2: Http2) {
    this.http2 = http2
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const origin = `${url.protocol}//${url.host}`

    return this.withStreamSlot(origin, () =>
      this.fetchWithSlot(origin, request, url)
    )
  }

  private async fetchWithSlot(
    origin: string,
    request: Request,
    url: URL
  ): Promise<Response> {
    const session = this.getSession(origin)
    const headers: import('node:http2').OutgoingHttpHeaders = {
      ':method': request.method,
      ':scheme': url.protocol.slice(0, -1),
      ':authority': url.host,
      ':path': `${url.pathname}${url.search}`,
    }

    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (
        lower === 'connection' ||
        lower === 'host' ||
        lower === 'keep-alive' ||
        lower === 'proxy-connection' ||
        lower === 'transfer-encoding' ||
        lower === 'upgrade'
      ) {
        return
      }

      headers[lower] = value
    })

    const stream = session.request(headers)
    const body =
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : Buffer.from(await request.arrayBuffer())

    return new Promise((resolve, reject) => {
      let settled = false

      const fail = (error: Error) => {
        if (settled) {
          return
        }
        settled = true
        reject(error)
      }

      const abort = () => {
        stream.close(this.http2.constants.NGHTTP2_CANCEL)
        fail(new DOMException('The operation was aborted.', 'AbortError'))
      }

      if (request.signal.aborted) {
        abort()
        return
      }

      request.signal.addEventListener('abort', abort, { once: true })
      stream.once('error', fail)
      stream.once('response', (headers) => {
        const status = Number(headers[':status'] ?? 0)
        const responseHeaders = new Headers()
        for (const [key, value] of Object.entries(headers)) {
          if (key.startsWith(':') || value === undefined) {
            continue
          }
          if (Array.isArray(value)) {
            value.forEach((item) => responseHeaders.append(key, String(item)))
          } else {
            responseHeaders.set(key, String(value))
          }
        }

        settled = true
        request.signal.removeEventListener('abort', abort)

        if (request.method === 'HEAD' || status === 204 || status === 205) {
          stream.resume()
          resolve(new Response(null, { status, headers: responseHeaders }))
          return
        }

        const cancelCode = this.http2.constants.NGHTTP2_CANCEL
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            stream.on('data', (chunk: Buffer) => {
              controller.enqueue(new Uint8Array(chunk))
            })
            stream.once('end', () => controller.close())
            stream.once('error', (error) => controller.error(error))
          },
          cancel() {
            stream.close(cancelCode)
          },
        })

        resolve(new Response(body, { status, headers: responseHeaders }))
      })

      stream.end(body)
    })
  }

  private getSession(origin: string) {
    const current = this.sessions.get(origin)
    if (current && !current.closed && !current.destroyed) {
      return current
    }

    const session = this.http2.connect(origin)
    session.once('close', () => {
      if (this.sessions.get(origin) === session) {
        this.sessions.delete(origin)
      }
    })
    session.once('error', () => {
      session.close()
    })
    this.sessions.set(origin, session)

    return session
  }

  private async withStreamSlot<T>(origin: string, fn: () => Promise<T>) {
    while ((this.activeStreams.get(origin) ?? 0) >= MAX_CONCURRENT_STREAMS) {
      await new Promise<void>((resolve) => {
        const waiters = this.streamWaiters.get(origin) ?? []
        waiters.push(resolve)
        this.streamWaiters.set(origin, waiters)
      })
    }

    this.activeStreams.set(origin, (this.activeStreams.get(origin) ?? 0) + 1)
    try {
      return await fn()
    } finally {
      this.activeStreams.set(origin, (this.activeStreams.get(origin) ?? 1) - 1)
      this.streamWaiters.get(origin)?.shift()?.()
    }
  }
}

let envdFetch: typeof fetch | undefined

export function createEnvdFetch(): typeof fetch {
  if (envdFetch) {
    return envdFetch
  }

  if (runtime !== 'node') {
    envdFetch = fetch
    return envdFetch
  }

  const http2 = dynamicRequire<Http2>('node:http2')
  const client = new NodeHttp2Fetch(http2)
  envdFetch = client.fetch

  return envdFetch
}
