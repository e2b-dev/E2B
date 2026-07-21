export type UndiciRequestInit = RequestInit & {
  dispatcher?: unknown
  duplex?: 'half'
}

export type UndiciModule = {
  Agent: new (options: { allowH2: true; connections?: number }) => unknown
  ProxyAgent: new (options: {
    uri: string
    allowH2: true
    connections?: number
    proxyTunnel: true
  }) => unknown
  fetch: unknown
  retryGracefulGoAway?: boolean
}

const UNDICI_8_MIN_NODE_MAJOR = 22
const UNDICI_8_MIN_NODE_MINOR = 19

export function getUndiciPackageCandidates(nodeVersion: string): string[] {
  const [major = 0, minor = 0] = nodeVersion
    .split('.', 2)
    .map((part) => Number.parseInt(part, 10))

  if (
    major > UNDICI_8_MIN_NODE_MAJOR ||
    (major === UNDICI_8_MIN_NODE_MAJOR && minor >= UNDICI_8_MIN_NODE_MINOR)
  ) {
    return ['undici8', 'undici']
  }

  return ['undici']
}

const GRACEFUL_HTTP2_GOAWAY_MESSAGE =
  'HTTP/2: "GOAWAY" frame received with code 0'

function isGracefulHttp2GoAway(error: unknown): boolean {
  const seen = new Set<unknown>()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)

    const candidate = current as {
      cause?: unknown
      code?: unknown
      message?: unknown
    }
    if (
      candidate.code === 'UND_ERR_SOCKET' &&
      candidate.message === GRACEFUL_HTTP2_GOAWAY_MESSAGE
    ) {
      return true
    }

    current = candidate.cause
  }

  return false
}

/**
 * Replay a request once when Undici rejects a safe request because its HTTP/2
 * session was gracefully retired. The original signal bounds both attempts.
 */
export function retryGracefulHttp2GoAway(fetcher: typeof fetch): typeof fetch {
  return (async (input, init) => {
    try {
      return await fetcher(input, init)
    } catch (error) {
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase()

      if (
        (method !== 'GET' && method !== 'HEAD') ||
        !isGracefulHttp2GoAway(error)
      ) {
        throw error
      }

      const signal =
        init && 'signal' in init
          ? init.signal
          : input instanceof Request
            ? input.signal
            : undefined
      signal?.throwIfAborted()

      return fetcher(input, init)
    }
  }) as typeof fetch
}

type UndiciImporter = (moduleName: string) => Promise<UndiciModule>

export async function loadUndici(
  importModule?: UndiciImporter
): Promise<UndiciModule | undefined> {
  // Keep this import opaque to bundlers. It must resolve as a package name
  // from the runtime environment, not as a path relative to this file.
  // eslint-disable-next-line no-new-func
  importModule ??= new Function(
    'moduleName',
    'return import(moduleName)'
  ) as UndiciImporter

  for (const packageName of getUndiciPackageCandidates(process.versions.node)) {
    try {
      const undici = await importModule(packageName)

      return {
        ...undici,
        retryGracefulGoAway: packageName === 'undici',
      }
    } catch {
      // Undici 8 is optional so Node 20 package managers can omit it.
    }
  }

  return undefined
}

export function toUndiciRequestInput(
  input: RequestInfo | URL,
  init?: RequestInit
): { input: RequestInfo | URL; init?: RequestInit & { duplex?: 'half' } } {
  if (!(input instanceof Request)) {
    return { input, init }
  }

  const requestInit: RequestInit & { duplex?: 'half' } = {
    body: input.body,
    cache: input.cache,
    credentials: input.credentials,
    headers: input.headers,
    integrity: input.integrity,
    keepalive: input.keepalive,
    method: input.method,
    mode: input.mode,
    redirect: input.redirect,
    referrer: input.referrer,
    referrerPolicy: input.referrerPolicy,
    signal: input.signal,
    ...init,
  }

  if (requestInit.body) {
    requestInit.duplex = 'half'
  }

  return {
    input: input.url,
    init: requestInit,
  }
}
