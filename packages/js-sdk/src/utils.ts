import platform from 'platform'

import { isBlobLike, isReadableStreamLike } from './brand'

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

  // @ts-ignore
  if (typeof EdgeRuntime === 'string') {
    return { runtime: 'vercel-edge', version: 'unknown' }
  }

  // Check the explicit Workers marker before the generic Node check — Node
  // compatibility shims (workerd's nodejs_compat, vitest-pool-workers) can
  // populate process.release.name inside Workers.
  if ((globalThis as any).navigator?.userAgent === 'Cloudflare-Workers') {
    return { runtime: 'cloudflare-worker', version: 'unknown' }
  }

  if ((globalThis as any).process?.release?.name === 'node') {
    return { runtime: 'node', version: platform.version || 'unknown' }
  }

  if (typeof window !== 'undefined') {
    return { runtime: 'browser', version: platform.version || 'unknown' }
  }

  return { runtime: 'unknown', version: 'unknown' }
}

export const { runtime, version: runtimeVersion } = getRuntime()

export async function sha256(data: string): Promise<string> {
  // WebCrypto is available in all supported runtimes (Node >= 20, browsers, edge)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = new Uint8Array(hashBuffer)
  return btoa(String.fromCharCode(...hashArray))
}

export function timeoutToSeconds(timeout: number): number {
  return Math.ceil(timeout / 1000)
}

/**
 * Import an optional, runtime-resolved package (e.g. `undici`, `glob`, `tar`)
 * without letting downstream bundlers resolve it at build time.
 *
 * The variable specifier plus the `webpackIgnore`/`@vite-ignore` annotations
 * keep the import opaque to bundlers, so browser/edge builds don't try to
 * pull node-only packages into the bundle, while plain Node resolves it
 * natively at runtime.
 */
export async function dynamicImport<T>(module: string): Promise<T> {
  if (runtime === 'browser') {
    throw new Error('Browser runtime is not supported for dynamic import')
  }

  // @ts-ignore
  return await import(/* webpackIgnore: true */ /* @vite-ignore */ module)
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
 * Adopt a stream that isn't a native `ReadableStream` — one from a polyfill, a
 * replaced global, or another realm — by pumping it through a native one.
 *
 * Platform APIs brand-check stream bodies: handed a foreign stream directly,
 * `fetch`/`Response` stringify it to `"[object ReadableStream]"` and
 * `pipeThrough` rejects a native `CompressionStream`. Reading through its
 * public reader is the one part of a stream that is portable.
 */
function toNativeStream(stream: ReadableStream): ReadableStream {
  // Kept out of the `if` condition on purpose: as a type guard it would narrow
  // the rest of the function to `never`, and a stream whose class disagrees
  // with the type is the whole reason this function exists.
  const isNative: boolean = stream instanceof ReadableStream
  if (isNative) {
    return stream
  }

  const reader = stream.getReader()
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      controller.enqueue(value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })
}

/**
 * Convert data to a Blob, avoiding unnecessary conversions when possible.
 */
export async function toBlob(
  data: string | ArrayBuffer | Blob | ReadableStream
): Promise<Blob> {
  // Already a native Blob - use directly
  if (data instanceof Blob) {
    return data
  }
  // A Blob from another Blob class must be copied: the platform brand-checks
  // blob bodies and would stringify this one to "[object Blob]".
  if (isBlobLike(data)) {
    return new Blob([await data.arrayBuffer()], { type: data.type })
  }
  // ReadableStream - must consume to get Blob
  if (isReadableStreamLike(data)) {
    return new Response(toNativeStream(data)).blob()
  }
  // String or ArrayBuffer - create Blob. A cross-realm ArrayBuffer needs no
  // special handling: buffer sources are recognized by V8, not by brand.
  return new Blob([data])
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
 * The body to upload, plus whether it is streamed to the API instead of being
 * buffered in memory. Callers need `streamed` to set half-duplex mode and to
 * skip the client-side request timeout, so it is reported here rather than
 * re-derived from the body — only this function knows the decision it made.
 */
export type UploadBody = {
  body: BodyInit
  streamed: boolean
}

/**
 * Prepare data for upload, optionally gzip-compressed.
 *
 * Outside the browser, streams (and gzip-compressed data) are uploaded as a
 * `ReadableStream` so they don't have to be buffered in memory. Browsers don't
 * support streaming request bodies, so data is buffered into a Blob there.
 */
export async function toUploadBody(
  data: string | ArrayBuffer | Blob | ReadableStream,
  gzip?: boolean
): Promise<UploadBody> {
  if (gzip) {
    const stream = isReadableStreamLike(data)
      ? toNativeStream(data)
      : isBlobLike(data)
        ? toNativeStream(data.stream())
        : (await toBlob(data)).stream()
    const compressed = stream.pipeThrough(new CompressionStream('gzip'))
    return runtime === 'browser'
      ? { body: await new Response(compressed).blob(), streamed: false }
      : { body: compressed, streamed: true }
  }

  if (isReadableStreamLike(data) && runtime !== 'browser') {
    return { body: toNativeStream(data), streamed: true }
  }

  return { body: await toBlob(data), streamed: false }
}
