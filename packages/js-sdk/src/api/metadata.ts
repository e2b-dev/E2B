import platform from 'platform'

import { version } from '../../package.json'

declare let window: any

type Runtime = 'node' | 'browser' | 'deno' | 'bun' | 'vercel-edge' | 'cloudflare-worker' | 'unknown'

function getRuntime(): { runtime: Runtime; version: string } {
  // @ts-ignore
  if ((globalThis as any).Bun) {
    // @ts-ignore
    return { runtime: 'bun', version: globalThis.Bun.version }
  }

  // @ts-ignore
  if ((globalThis as any).Deno) {
    // @ts-ignore
    return { runtime: 'deno', version: globalThis.Deno.version.deno }
  }

  if ((globalThis as any).process?.release?.name === 'node') {
    return { runtime: 'node', version: platform.version || 'unknown' }
  }

  // @ts-ignore
  if (typeof EdgeRuntime === 'string') {
    return { runtime: 'vercel-edge', version: 'unknown' }
  }

  if ((globalThis as any).navigator?.userAgent === 'Cloudflare-Workers') {
    return { runtime: 'cloudflare-worker', version: 'unknown' }
  }

  if (typeof window !== 'undefined') {
    return { runtime: 'browser', version: platform.version || 'unknown' }
  }

  return { runtime: 'unknown', version: 'unknown' }
}

export const { runtime, version: runtimeVersion } = getRuntime()

export const defaultHeaders = {
  browser: (typeof window !== 'undefined' && platform.name) || 'unknown',
  lang: 'js',
  lang_version: runtimeVersion,
  package_version: version,
  publisher: 'e2b',
  sdk_runtime: runtime,
  system: platform.os?.family || 'unknown',
}

export function getEnvVar(name: string) {
  if (runtime === 'deno') {
    // @ts-ignore
    return Deno.env.get(name)
  }

  return process.env[name]
}
