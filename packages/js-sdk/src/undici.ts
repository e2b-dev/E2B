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
  }) => unknown
  fetch: unknown
}

export async function loadUndici(): Promise<UndiciModule | undefined> {
  try {
    // Keep this import opaque to bundlers. It must resolve as a package name
    // from the runtime environment, not as a path relative to this file.
    // eslint-disable-next-line no-new-func
    const importModule = new Function(
      'moduleName',
      'return import(moduleName)'
    ) as (moduleName: string) => Promise<UndiciModule>

    return await importModule('undici')
  } catch {
    return undefined
  }
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
