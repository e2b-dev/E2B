export type UndiciRequestInit = RequestInit & {
  dispatcher?: unknown
  duplex?: 'half'
}

export type UndiciModule = {
  Agent: new (options: { allowH2: true; connections?: number }) => unknown
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
