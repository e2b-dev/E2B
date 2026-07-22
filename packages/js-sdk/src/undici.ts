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

type UndiciImporter = (moduleName: string) => Promise<UndiciModule>

// Keep package imports opaque so downstream bundlers resolve them at runtime.
// eslint-disable-next-line no-new-func
const importUndici = new Function(
  'moduleName',
  'return import(moduleName)'
) as UndiciImporter

export async function loadUndici(
  importModule = importUndici
): Promise<UndiciModule | undefined> {
  for (const packageName of getUndiciPackageCandidates(process.versions.node)) {
    try {
      return await importModule(packageName)
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
