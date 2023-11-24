import platform from 'platform'

import { version } from '../../package.json'

declare let window: any;

export const defaultHeaders = {
  browser: (typeof window !== 'undefined' && platform.name) || 'undefined',
  lang: 'js',
  lang_version: platform.version || 'unknown',
  package_version: version,
  publisher: 'e2b',
  sdk_runtime: typeof window === 'undefined' ? 'node' : 'browser',
  system: platform.os?.family || 'unknown',
}
