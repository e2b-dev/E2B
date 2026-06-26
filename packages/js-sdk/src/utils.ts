import platform from 'platform'
import type { ConnectionOpts } from './connectionConfig'

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

/**
 * Generic, reusable paginator for cursor-based list endpoints.
 *
 * The base owns the shared pagination state — `hasNext`, `nextToken`, and the
 * reading of the `x-next-token` response header (via {@link Paginator.updatePagination}).
 * Each concrete paginator implements {@link Paginator.nextItems} to do the
 * actual fetching for its endpoint, so any model can expose pagination by
 * subclassing this without reimplementing the bookkeeping.
 *
 * The optional `O` type parameter is the per-call options type accepted by
 * `nextItems` (e.g. connection options for a given API).
 *
 * @example
 * ```ts
 * const paginator = Sandbox.list()
 * while (paginator.hasNext) {
 *   const items = await paginator.nextItems()
 *   console.log(items)
 * }
 * ```
 */
export abstract class Paginator<T, O extends ConnectionOpts = ConnectionOpts> {
  protected readonly opts?: O
  protected readonly limit?: number

  private _hasNext: boolean
  private _nextToken?: string

  constructor(opts?: O, limit?: number, nextToken?: string) {
    this.opts = opts
    this.limit = limit

    this._hasNext = true
    this._nextToken = nextToken
  }

  /**
   * Returns true if there are more items to fetch.
   */
  get hasNext(): boolean {
    return this._hasNext
  }

  /**
   * Returns the next token to use for pagination.
   */
  get nextToken(): string | undefined {
    return this._nextToken
  }

  /**
   * Update the pagination state from a response, reading the `x-next-token`
   * header. Concrete paginators call this from {@link Paginator.nextItems}
   * after fetching a page.
   */
  protected updatePagination(response: Response) {
    this._nextToken = response.headers.get('x-next-token') || undefined
    this._hasNext = !!this._nextToken
  }

  /**
   * Get the next page of items.
   *
   * @param opts per-call connection options. When provided, this call uses
   * these options (e.g. `apiKey`, `domain`, `headers`, `requestTimeoutMs`,
   * `signal`) instead of the ones the paginator was constructed with.
   * Aborting a page via `signal` does not affect subsequent {@link Paginator.nextItems}
   * calls — pass a fresh signal each call you want to be cancellable.
   *
   * @throws Error if there are no more items to fetch. Call this method only if `hasNext` is `true`.
   *
   * @returns List of items
   */
  abstract nextItems(opts?: O): Promise<T[]>
}

export function dynamicRequire<T>(module: string): T {
  if (runtime === 'browser') {
    throw new Error('Browser runtime is not supported for require')
  }

  return require(module)
}

export async function dynamicImport<T>(module: string): Promise<T> {
  if (runtime === 'browser') {
    throw new Error('Browser runtime is not supported for dynamic import')
  }

  // @ts-ignore
  return await import(module)
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

/**
 * Convert data to a Blob, avoiding unnecessary conversions when possible.
 */
export function toBlob(
  data: string | ArrayBuffer | Blob | ReadableStream
): Blob | Promise<Blob> {
  // Already a Blob - use directly
  if (data instanceof Blob) {
    return data
  }
  // String or ArrayBuffer - create Blob
  if (typeof data === 'string' || data instanceof ArrayBuffer) {
    return new Blob([data])
  }
  // ReadableStream - must consume to get Blob
  return new Response(data).blob()
}

// Characters that are safe to leave unquoted in a POSIX shell, matching the
// set used by Python's shlex.quote (`[^\w@%+=:,./-]` is considered unsafe).
const UNSAFE_SHELL_CHAR = /[^\w@%+=:,./-]/

/**
 * Quote a string for safe interpolation into a POSIX shell command.
 *
 * Faithful port of Python's `shlex.quote`: an empty string becomes `''`,
 * values containing only safe characters are returned unchanged (keeping
 * generated commands stable and cache-friendly), and anything else is wrapped
 * in single quotes with embedded single quotes escaped as `'"'"'`.
 */
export function shellQuote(s: string): string {
  if (s === '') {
    return "''"
  }
  if (!UNSAFE_SHELL_CHAR.test(s)) {
    return s
  }
  return "'" + s.replace(/'/g, "'\"'\"'") + "'"
}

/**
 * Prepare data for upload as a BodyInit, optionally gzip-compressed.
 *
 * Outside the browser, streams (and gzip-compressed data) are returned as
 * `ReadableStream` so they can be uploaded without buffering in memory.
 * Browsers don't support streaming request bodies, so data is buffered into
 * a Blob there.
 */
export async function toUploadBody(
  data: string | ArrayBuffer | Blob | ReadableStream,
  gzip?: boolean
): Promise<BodyInit> {
  if (gzip) {
    const stream =
      data instanceof ReadableStream
        ? data
        : data instanceof Blob
          ? data.stream()
          : new Blob([data]).stream()
    const compressed = stream.pipeThrough(new CompressionStream('gzip'))
    return runtime === 'browser' ? new Response(compressed).blob() : compressed
  }

  if (data instanceof ReadableStream && runtime !== 'browser') {
    return data
  }

  return toBlob(data)
}
