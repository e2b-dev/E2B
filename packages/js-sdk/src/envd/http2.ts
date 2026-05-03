import { dynamicRequire, runtime } from '../utils'

const IDLE_SESSION_TIMEOUT_MS = 30_000
const MAX_REDIRECTS = 20

type Http2 = typeof import('node:http2')
type ClientHttp2Session = import('node:http2').ClientHttp2Session

class NodeHttp2Fetch {
  private readonly http2: Http2
  private readonly idleSessionTimeoutMs: number
  private readonly sessions = new Map<string, ClientHttp2Session>()
  private readonly activeStreams = new Map<string, number>()
  private readonly idleTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(http2: Http2, idleSessionTimeoutMs = IDLE_SESSION_TIMEOUT_MS) {
    this.http2 = http2
    this.idleSessionTimeoutMs = idleSessionTimeoutMs
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)

    return this.fetchWithSession(request, url, 0)
  }

  private async fetchWithSession(
    request: Request,
    url: URL,
    redirectCount: number
  ): Promise<Response> {
    const origin = `${url.protocol}//${url.host}`
    const requestBody =
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : Buffer.from(await request.arrayBuffer())
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
    this.addStream(origin)

    return new Promise((resolve, reject) => {
      const cancelCode = this.http2.constants.NGHTTP2_CANCEL
      let settled = false
      let streamReleased = false
      let bodyClosed = false
      let bodyController:
        | ReadableStreamDefaultController<Uint8Array>
        | undefined

      const releaseStream = () => {
        if (streamReleased) {
          return
        }
        streamReleased = true
        this.removeStream(origin)
      }

      const closeBody = (handle: () => void) => {
        if (bodyClosed) {
          return
        }
        bodyClosed = true
        request.signal.removeEventListener('abort', abort)
        releaseStream()
        handle()
      }

      const fail = (error: Error) => {
        if (settled) {
          return
        }
        settled = true
        request.signal.removeEventListener('abort', abort)
        releaseStream()
        reject(error)
      }

      const abortError = () =>
        new DOMException('The operation was aborted.', 'AbortError')

      const abort = () => {
        stream.close(cancelCode)
        const controller = bodyController
        if (controller) {
          closeBody(() => controller.error(abortError()))
        }
        fail(abortError())
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

        if (isRedirect(status) && responseHeaders.has('location')) {
          if (request.redirect === 'error') {
            stream.resume()
            request.signal.removeEventListener('abort', abort)
            releaseStream()
            reject(new TypeError('fetch failed'))
            return
          }

          if (request.redirect === 'follow') {
            if (redirectCount >= MAX_REDIRECTS) {
              stream.resume()
              request.signal.removeEventListener('abort', abort)
              releaseStream()
              reject(new TypeError('fetch failed'))
              return
            }

            stream.resume()
            request.signal.removeEventListener('abort', abort)
            releaseStream()

            const redirectUrl = new URL(responseHeaders.get('location')!, url)
            const redirectRequest = createRedirectRequest(
              request,
              redirectUrl,
              status,
              requestBody
            )

            resolve(
              this.fetchWithSession(
                redirectRequest,
                redirectUrl,
                redirectCount + 1
              )
            )
            return
          }
        }

        if (request.method === 'HEAD' || status === 204 || status === 205) {
          stream.resume()
          request.signal.removeEventListener('abort', abort)
          releaseStream()
          resolve(new Response(null, { status, headers: responseHeaders }))
          return
        }

        const responseBody = new ReadableStream<Uint8Array>({
          start(controller) {
            bodyController = controller
            stream.on('data', (chunk: Buffer) => {
              if (bodyClosed) {
                return
              }
              controller.enqueue(new Uint8Array(chunk))
              if ((controller.desiredSize ?? 1) <= 0) {
                stream.pause()
              }
            })
            stream.once('end', () => closeBody(() => controller.close()))
            stream.once('error', (error) =>
              closeBody(() => controller.error(error))
            )
          },
          pull() {
            stream.resume()
          },
          cancel() {
            closeBody(() => undefined)
            stream.close(cancelCode)
          },
        })

        resolve(
          new Response(responseBody, { status, headers: responseHeaders })
        )
      })

      stream.end(requestBody)
    })
  }

  private getSession(origin: string) {
    const current = this.sessions.get(origin)
    if (current && !current.closed && !current.destroyed) {
      current.ref()
      return current
    }

    const session = this.http2.connect(origin)
    session.ref()
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

  private addStream(origin: string) {
    const timer = this.idleTimers.get(origin)
    if (timer) {
      clearTimeout(timer)
      this.idleTimers.delete(origin)
    }

    this.activeStreams.set(origin, (this.activeStreams.get(origin) ?? 0) + 1)
  }

  private removeStream(origin: string) {
    const active = Math.max((this.activeStreams.get(origin) ?? 1) - 1, 0)
    if (active > 0) {
      this.activeStreams.set(origin, active)
      return
    }

    this.activeStreams.delete(origin)
    const session = this.sessions.get(origin)
    session?.unref()
    const timer = setTimeout(() => {
      if (session && !session.closed && !session.destroyed) {
        session.close()
      }
      this.idleTimers.delete(origin)
    }, this.idleSessionTimeoutMs)
    ;(timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.()
    this.idleTimers.set(origin, timer)
  }
}

function isRedirect(status: number) {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  )
}

function createRedirectRequest(
  request: Request,
  url: URL,
  status: number,
  body: Buffer | undefined
) {
  const headers = new Headers(request.headers)
  let method = request.method
  let redirectBody: Buffer | undefined = body

  if (
    status === 303 ||
    ((status === 301 || status === 302) && request.method === 'POST')
  ) {
    method = 'GET'
    redirectBody = undefined
    headers.delete('content-length')
    headers.delete('content-type')
  }

  return new Request(url, {
    body: redirectBody,
    headers,
    method,
    redirect: request.redirect,
    signal: request.signal,
  })
}

let envdFetch: typeof fetch | undefined

type EnvdFetchOptions = {
  idleSessionTimeoutMs?: number
}

export function createEnvdFetchForRuntime(
  currentRuntime = runtime,
  options: EnvdFetchOptions = {}
): typeof fetch {
  if (currentRuntime !== 'node') {
    return fetch
  }

  const http2 = dynamicRequire<Http2>('node:http2')
  const client = new NodeHttp2Fetch(http2, options.idleSessionTimeoutMs)

  return client.fetch
}

export function createEnvdFetch(): typeof fetch {
  if (envdFetch) {
    return envdFetch
  }

  envdFetch = createEnvdFetchForRuntime(runtime)

  return envdFetch
}
