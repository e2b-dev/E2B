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
