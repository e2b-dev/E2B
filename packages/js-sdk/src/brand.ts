/**
 * Class-agnostic checks for web platform objects.
 *
 * `value instanceof Blob` does not answer "is this a Blob", it answers "was
 * this minted by *the* `Blob` class this module happens to see". In a Node
 * process those are different questions: libraries replace the web globals the
 * same way they replace `globalThis.fetch` — `@hono/node-server` installs its
 * own `Request`, remix's `installGlobals()` swaps `Request`/`Blob`/`File`,
 * `web-streams-polyfill` swaps `ReadableStream`, jsdom-based test environments
 * bring their own copies of all of them — and values also cross realms
 * (`node:vm`, `worker_threads`). A perfectly good Blob then fails the brand
 * check and the SDK silently takes the wrong branch.
 *
 * The failure modes are not theoretical; each one is covered by a test:
 * - a Request the current global class disowns is handed to undici verbatim and
 *   every API call dies with `Failed to parse URL from [object Request]`;
 * - a foreign `Blob` or `ReadableStream` body is stringified by the platform,
 *   so the upload silently contains the text `[object Blob]`;
 * - a foreign `ReadableStream` upload is buffered into memory instead of
 *   streamed, or hangs when piped through `CompressionStream`;
 * - a foreign `Blob` response body reads back as an empty file.
 *
 * So ask what a value *is*, not who made it: keep `instanceof` as the fast
 * path, then fall back to the members and `Symbol.toStringTag` the platform
 * guarantees. Detection is only half of it — see `toBlob`/`toUploadBody` in
 * `utils.ts`, which convert what they detect into a native equivalent before
 * handing it to the platform.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * The value's `Symbol.toStringTag`, e.g. `'Blob'` for anything implementing the
 * `Blob` interface. Spec'd for every web platform interface and inherited by
 * subclasses, so it survives both realm and class swaps.
 */
function platformTag(value: object): string {
  return Object.prototype.toString.call(value).slice('[object '.length, -1)
}

/**
 * Whether `value` should be treated as a `Request`.
 *
 * Duck-typed on `url` + `method` + `clone` rather than on the tag, because
 * older `fetch` ponyfills predate `Symbol.toStringTag`; `clone` is what
 * separates a `Request` from other `{ url, method }` carriers such as Node's
 * `IncomingMessage`.
 */
export function isRequestLike(value: unknown): value is Request {
  return (
    value instanceof Request ||
    (isObject(value) &&
      typeof value.url === 'string' &&
      typeof value.method === 'string' &&
      typeof value.clone === 'function')
  )
}

/**
 * Whether `value` should be treated as a `Blob` (or a `File`, which is a
 * `Blob`).
 *
 * `arrayBuffer` is the only member required beyond the tag, because reading the
 * bytes is all the SDK ever does with a Blob it didn't make — asking for
 * `stream` too would turn implementations that lack it into corrupted uploads
 * for no gain.
 */
export function isBlobLike(value: unknown): value is Blob {
  if (value instanceof Blob) {
    return true
  }
  if (!isObject(value)) {
    return false
  }

  const tag = platformTag(value)
  return (
    (tag === 'Blob' || tag === 'File') &&
    typeof value.arrayBuffer === 'function'
  )
}

/**
 * Whether `value` should be treated as a `ReadableStream`.
 *
 * `getReader` + `tee` + `cancel` is unmistakable enough to skip the tag, which
 * keeps this working for stream implementations that only got a
 * `Symbol.toStringTag` in later versions.
 */
export function isReadableStreamLike(value: unknown): value is ReadableStream {
  return (
    value instanceof ReadableStream ||
    (isObject(value) &&
      typeof value.getReader === 'function' &&
      typeof value.tee === 'function' &&
      typeof value.cancel === 'function')
  )
}

/**
 * Whether `value` should be treated as an `ArrayBuffer`.
 *
 * Unlike the others this needs no conversion afterwards: the platform detects
 * buffer sources through V8 rather than by brand, so a cross-realm
 * `ArrayBuffer` is already accepted everywhere a native one is.
 */
export function isArrayBufferLike(value: unknown): value is ArrayBuffer {
  return (
    value instanceof ArrayBuffer ||
    (isObject(value) && platformTag(value) === 'ArrayBuffer')
  )
}
