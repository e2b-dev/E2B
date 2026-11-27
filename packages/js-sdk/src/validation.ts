import { defaultPathSerializer } from 'openapi-fetch'

import { InvalidArgumentError } from './errors'

/**
 * Checks for arguments the server never gets to judge: the SDK turns them into
 * a URL, a timer, a shell word or a request field of its own before anything
 * is sent, so a bad value would act as a different one instead of being
 * refused. What the API can check for itself is left to the API.
 */

/** Longest delay a timer takes; a longer one fires after 1 ms instead. */
const MAX_TIMER_MS = 2 ** 31 - 1

/** Name the shape of a value, for an error message. */
export function describeValue(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (typeof value !== 'object') {
    return typeof value
  }

  return Array.isArray(value) ? 'array' : (value.constructor?.name ?? 'object')
}

function show(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  return typeof value === 'number' ? String(value) : describeValue(value)
}

/**
 * Check a timeout that becomes a local timer or an RPC deadline, and return
 * the delay to arm it with. `0` disables the timeout and so does `Infinity`;
 * a delay longer than a timer can hold is shortened to the longest one.
 */
export function resolveTimeoutMs(
  timeoutMs: number | undefined,
  name: string
): number | undefined {
  // `== null` also takes an explicit `null` from a caller without types.
  if (timeoutMs == null) {
    return undefined
  }

  if (
    typeof timeoutMs !== 'number' ||
    Number.isNaN(timeoutMs) ||
    timeoutMs < 0
  ) {
    throw new InvalidArgumentError(
      `Invalid ${name}=${show(timeoutMs)}: expected a non-negative number of milliseconds, or 0 to disable the timeout.`
    )
  }

  if (timeoutMs === Infinity) {
    return 0
  }

  return Math.min(Math.ceil(timeoutMs), MAX_TIMER_MS)
}

/** Check that a value is an integer in `[min, max]`. */
export function assertInteger(
  value: unknown,
  name: string,
  min: number,
  max: number
): asserts value is number {
  if (
    !Number.isInteger(value) ||
    (value as number) < min ||
    (value as number) > max
  ) {
    throw new InvalidArgumentError(
      `Invalid ${name}=${show(value)}: expected an integer between ${min} and ${max}.`
    )
  }
}

/**
 * Check a process ID. envd takes it as an unsigned 32-bit integer.
 */
export function assertPid(pid: unknown): asserts pid is number {
  assertInteger(pid, 'pid', 0, 2 ** 32 - 1)
}

/**
 * Check a PTY size. envd holds each side in 16 bits, so a larger one would
 * wrap around.
 */
export function assertPtySize(size: { cols: unknown; rows: unknown }): void {
  assertInteger(size?.cols, 'cols', 1, 2 ** 16 - 1)
  assertInteger(size?.rows, 'rows', 1, 2 ** 16 - 1)
}

/**
 * Check a value that becomes one segment of a request path. An empty segment
 * or a dot segment does not stay where it is put: the URL collapses onto a
 * different route.
 */
export function assertPathSegment(
  value: unknown,
  name: string
): asserts value is string {
  if (
    typeof value !== 'string' ||
    value === '' ||
    value === '.' ||
    value === '..'
  ) {
    throw new InvalidArgumentError(
      `Invalid ${name} ${show(value)}: expected a non-empty string other than '.' and '..'.`
    )
  }
}

/**
 * Path serializer for the API clients: every `{param}` of the route is checked
 * with {@link assertPathSegment} before it is encoded into the URL.
 */
export function pathSerializer(
  pathname: string,
  pathParams: Record<string, unknown>
): string {
  for (const match of pathname.match(/\{[^{}]+\}/g) ?? []) {
    const name = match.slice(1, -1)
    assertPathSegment(pathParams?.[name], name)
  }

  return defaultPathSerializer(pathname, pathParams)
}

/**
 * Check a sandbox file path that must name something. envd reads an empty path
 * as the user's home directory.
 */
export function assertNonEmptyPath(
  path: unknown,
  name: string
): asserts path is string {
  if (typeof path !== 'string' || path === '') {
    throw new InvalidArgumentError(
      `Invalid ${name} ${show(path)}: expected a non-empty path. An empty path stands for the user's home directory.`
    )
  }
}

/**
 * Check that every value of a string map is a string. `JSON.stringify` drops
 * an `undefined` value, so the request would go out without the key.
 */
export function assertStringValues(
  record: Record<string, unknown> | null | undefined,
  name: string
): void {
  for (const [key, value] of Object.entries(record ?? {})) {
    if (typeof value !== 'string') {
      throw new InvalidArgumentError(
        `Invalid ${name}[${JSON.stringify(key)}]: expected a string, got ${describeValue(value)}.`
      )
    }
  }
}

/**
 * Check that no value of a map is missing. Unlike
 * {@link assertStringValues} this leaves a value of another type to whoever
 * reads the map next: a transform header may hold an iam token placeholder
 * that names its own error when it is serialized.
 */
export function assertNoMissingValues(
  record: Record<string, unknown> | null | undefined,
  name: string
): void {
  for (const [key, value] of Object.entries(record ?? {})) {
    if (value == null) {
      throw new InvalidArgumentError(
        `Invalid ${name}[${JSON.stringify(key)}]: expected a string, got ${describeValue(value)}.`
      )
    }
  }
}

/**
 * Check that a value is a list of strings. A string spreads into its
 * characters, so it is refused and not read as a list of one.
 */
export function assertStringList(
  value: unknown,
  name: string
): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new InvalidArgumentError(
      `Invalid ${name}: expected a list of strings, got ${
        Array.isArray(value) ? 'a list with other values' : describeValue(value)
      }.`
    )
  }
}
