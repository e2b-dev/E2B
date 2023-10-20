import platform from 'platform'

import { version } from '../../package.json'


export const defaultHeaders = {
  package_version: version,
  lang: 'js',
  engine: platform.name || 'unknown',
  lang_version: platform.version || 'unknown',
  system: platform.os?.family || 'unknown',
  publisher: 'e2b',
}
