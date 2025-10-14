import platform from 'platform'

declare let window: any

type Runtime =
  | 'node'
  | 'browser'
  | 'deno'
  | 'bun'
  | 'vercel-edge'
  | 'cloudflare-worker'
  | 'unknown'

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

export async function sha256(data: string): Promise<string> {
  // Use WebCrypto API if available
  if (typeof crypto !== 'undefined') {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = new Uint8Array(hashBuffer)
    return btoa(String.fromCharCode(...hashArray))
  }

  // Use Node.js crypto if WebCrypto is not available
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require('node:crypto')
  const hash = createHash('sha256').update(data, 'utf8').digest()
  return hash.toString('base64')
}

export function timeoutToSeconds(timeout: number): number {
  return Math.ceil(timeout / 1000)
}

export async function dynamicGlob(): Promise<typeof import('glob')> {
  if (runtime === 'browser') {
    throw new Error('Browser runtime is not supported for glob')
  }

  // @ts-ignore
  return await import('glob')
}

export async function dynamicTar(): Promise<typeof import('tar')> {
  if (runtime === 'browser') {
    throw new Error('Browser runtime is not supported for tar')
  }

  // @ts-ignore
  return await import('tar')
}

// Source: https://github.com/chalk/ansi-regex/blob/main/index.js
function ansiRegex({ onlyFirst = false } = {}) {
  // Valid string terminator sequences are BEL, ESC\, and 0x9c
  const ST = '(?:\\u0007|\\u001B\\u005C|\\u009C)'
  // OSC sequences only: ESC ] ... ST (non-greedy until the first ST)
  const osc = `(?:\\u001B\\][\\s\\S]*?${ST})`
  // CSI and related: ESC/C1, optional intermediates, optional params (supports ; and :) then final byte
  const csi =
    '[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]'

  const pattern = `${osc}|${csi}`

  return new RegExp(pattern, onlyFirst ? undefined : 'g')
}

export function stripAnsi(text: string): string {
  return text.replace(ansiRegex(), '')
}

export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
