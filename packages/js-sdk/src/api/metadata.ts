import platform from 'platform'

import { version } from '../../package.json'

export const defaultHeaders = {
  browser: typeof window === 'undefined' ? undefined : platform.name,
  lang: 'js',
  lang_version: platform.version || 'unknown',
  package_version: version,
  publisher: 'e2b',
  runtime: typeof window === 'undefined' ? 'node' : 'browser',
  system: platform.os?.family || 'unknown',
}
