import 'cross-fetch/polyfill'
import { Fetcher } from 'openapi-typescript-fetch'
import platform from 'platform'

import { API_DOMAIN } from '../constants'
import type { components, paths } from './schema.gen'

interface Headers {
  [key: string]: string
}

export class E2BClient {
  public client = Fetcher.for<paths>()
  public createSession = this.client
    .path('/instances')
    .method('post')
    .create()
  public refreshSession = this.client
    .path('/instances/{instanceID}/refreshes')
    .method('post')
    .create()

  constructor(additional_headers?: Headers) {
    this.client.configure({
      baseUrl: `https://${API_DOMAIN}`,
      init: {
        headers: {
          package_version: '__pkgVersion__',
          lang: 'js',
          engine: platform.name || 'unknown',
          lang_version: platform.version || 'unknown',
          system: platform.os?.family || 'unknown',
          publisher: 'e2b',
          ...additional_headers,
        },
      },
    })
  }
}

export default E2BClient
export type { components, paths }
