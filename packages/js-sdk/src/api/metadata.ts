import platform from 'platform'

export const defaultHeaders = {
  package_version: '__pkgVersion__',
  lang: 'js',
  engine: platform.name || 'unknown',
  lang_version: platform.version || 'unknown',
  system: platform.os?.family || 'unknown',
  publisher: 'e2b',
}
