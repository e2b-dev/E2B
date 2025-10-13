import platform from 'platform'

declare let window: any

/**
 * Supported JavaScript/TypeScript runtimes.
 */
type Runtime =
  | 'node'
  | 'browser'
  | 'deno'
  | 'bun'
  | 'vercel-edge'
  | 'cloudflare-worker'
  | 'unknown'

/**
 * Detect the current JavaScript runtime environment.
 *
 * @returns Object containing the runtime name and version
 * @internal
 */
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

/**
 * Detected runtime and version information.
 * @internal
 */
export const { runtime, version: runtimeVersion } = getRuntime()

/**
 * Calculate SHA-256 hash of a string.
 * Uses WebCrypto API when available, falls back to Node.js crypto.
 *
 * @param data String to hash
 * @returns Base64-encoded hash
 * @internal
 */
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

/**
 * Convert milliseconds to seconds, rounding up.
 *
 * @param timeout Time in milliseconds
 * @returns Time in seconds
 * @internal
 */
export function timeoutToSeconds(timeout: number): number {
  return Math.ceil(timeout / 1000)
}

/**
 * Dynamically import the glob module.
 * Only works in Node.js/Bun/Deno runtimes.
 *
 * @returns glob module
 * @throws Error if called in browser runtime
 * @internal
 */
export async function dynamicGlob(): Promise<typeof import('glob')> {
  if (runtime === 'browser') {
    throw new Error('Browser runtime is not supported for glob')
  }

  // @ts-ignore
  return await import('glob')
}

/**
 * Dynamically import the tar module.
 * Only works in Node.js/Bun/Deno runtimes.
 *
 * @returns tar module
 * @throws Error if called in browser runtime
 * @internal
 */
export async function dynamicTar(): Promise<typeof import('tar')> {
  if (runtime === 'browser') {
    throw new Error('Browser runtime is not supported for tar')
  }

  // @ts-ignore
  return await import('tar')
}

/**
 * Create a regex pattern to match ANSI escape codes.
 * Source: https://github.com/chalk/ansi-regex/blob/main/index.js
 *
 * @param options Configuration options
 * @param options.onlyFirst If true, matches only the first occurrence
 * @returns Regular expression to match ANSI escape codes
 * @internal
 */
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

/**
 * Remove ANSI escape codes from a string.
 *
 * @param text String potentially containing ANSI codes
 * @returns String with all ANSI codes removed
 *
 * @example
 * ```ts
 * stripAnsi('\x1b[31mRed text\x1b[0m') // Returns "Red text"
 * ```
 */
export function stripAnsi(text: string): string {
  return text.replace(ansiRegex(), '')
}

/**
 * Wait for a specified number of milliseconds.
 *
 * @param ms Number of milliseconds to wait
 * @returns Promise that resolves after the specified time
 *
 * @example
 * ```ts
 * await wait(1000) // Wait for 1 second
 * ```
 */
export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
