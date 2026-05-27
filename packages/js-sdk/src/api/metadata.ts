import platform from 'platform'

import { version } from '../../package.json'
import { runtime, runtimeVersion } from '../utils'

export { version }

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

  if (typeof process === 'undefined') {
    return ''
  }

  return process.env[name]
}

/**
 * Parse an env var as a base-10 integer, falling back to `defaultValue` when
 * the env var is unset. Throws on non-integer input rather than silently
 * falling back so misconfiguration is surfaced loudly.
 */
export function parseIntEnv(name: string, defaultValue: number): number {
  const raw = getEnvVar(name)
  if (!raw) return defaultValue

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Invalid ${name}=${JSON.stringify(raw)}: expected an integer.`
    )
  }

  return parsed
}

/**
 * Parse an env var that must be a positive integer (>= 1). Throws on
 * non-positive or non-integer input.
 */
export function parsePositiveIntEnv(
  name: string,
  defaultValue: number
): number {
  const parsed = parseIntEnv(name, defaultValue)
  if (parsed < 1) {
    throw new Error(`Invalid ${name}=${parsed}: expected a positive integer.`)
  }

  return parsed
}

/**
 * Parse an inflight-limit env var. Returns `0` to disable the cap (documented
 * opt-out) or a positive integer to cap concurrency. Throws on non-integer or
 * negative values so misconfiguration is surfaced loudly rather than silently
 * removing the cap. A return value of `0` is recognized by
 * {@link limitConcurrency} as "no cap".
 */
export function parseInflightLimitEnv(
  name: string,
  defaultValue: number
): number {
  const parsed = parseIntEnv(name, defaultValue)
  if (parsed < 0) {
    throw new Error(
      `Invalid ${name}=${parsed}: expected a non-negative integer ` +
        '(use 0 to disable the cap).'
    )
  }
  return parsed
}
