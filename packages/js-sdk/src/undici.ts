import { compareVersions } from 'compare-versions'

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

const UNDICI_8_MIN_NODE = '22.19.0'

export function getUndiciPackageCandidates(nodeVersion: string): string[] {
  if (compareVersions(nodeVersion, UNDICI_8_MIN_NODE) >= 0) {
    return ['undici8', 'undici']
  }

  return ['undici']
}

export async function loadUndici(): Promise<UndiciModule | undefined> {
  let importModule: (moduleName: string) => Promise<UndiciModule>
  try {
    // Keep package imports opaque so downstream bundlers resolve them at runtime.
    // eslint-disable-next-line no-new-func
    importModule = new Function('moduleName', 'return import(moduleName)') as (
      moduleName: string
    ) => Promise<UndiciModule>
  } catch {
    return undefined
  }

  for (const packageName of getUndiciPackageCandidates(process.versions.node)) {
    try {
      return await importModule(packageName)
    } catch {
      // Try the next package supported by this Node version.
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
