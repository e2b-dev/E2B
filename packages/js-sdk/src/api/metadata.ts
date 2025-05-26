import platform from 'platform'

import { version } from '../../package.json'

declare let window: unknown

type Runtime = 'node' | 'browser' | 'deno' | 'bun' | 'vercel-edge' | 'cloudflare-worker' | 'unknown'

interface GlobalThisWithBun extends Window {
  Bun?: { version: string };
}

interface GlobalThisWithDeno extends Window {
  Deno?: { version: { deno: string }; env: { get: (key: string) => string | undefined } };
}

interface GlobalThisWithProcess extends Window {
  process?: { release?: { name?: string }; env?: { [key: string]: string | undefined } };
}

interface GlobalThisWithNavigator extends Window {
  navigator?: { userAgent?: string };
}

declare const EdgeRuntime: string | undefined;

function getRuntime(): { runtime: Runtime; version: string } {
  // @ts-ignore
  if ((globalThis as GlobalThisWithBun).Bun) {
    // @ts-ignore
    return { runtime: 'bun', version: (globalThis as GlobalThisWithBun).Bun.version }
  }

  // @ts-ignore
  if ((globalThis as GlobalThisWithDeno).Deno) {
    // @ts-ignore
    return { runtime: 'deno', version: (globalThis as GlobalThisWithDeno).Deno.version.deno }
  }

  if ((globalThis as GlobalThisWithProcess).process?.release?.name === 'node') {
    return { runtime: 'node', version: platform.version || 'unknown' }
  }

  // @ts-ignore
  if (typeof EdgeRuntime === 'string') {
    return { runtime: 'vercel-edge', version: 'unknown' }
  }

  if ((globalThis as GlobalThisWithNavigator).navigator?.userAgent === 'Cloudflare-Workers') {
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
    return (globalThis as GlobalThisWithDeno).Deno.env.get(name)
  }

  if (typeof (globalThis as GlobalThisWithProcess).process === 'undefined') {
    return undefined
  }

  return (globalThis as GlobalThisWithProcess).process.env[name]
}
