import * as fetcher from 'openapi-typescript-fetch'
import type { OpArgType, TypedFetch } from 'openapi-typescript-fetch'

import type { components, paths } from './schema.gen'
import { defaultHeaders } from './metadata'
import { ConnectionConfig } from '../connectionConfig'

const { Fetcher } = fetcher

class APIClient {
  private client = Fetcher.for<paths>()

  constructor(private config: ConnectionConfig) {
    this.client.configure({
      baseUrl: this.config.apiUrl,
      init: {
        headers: defaultHeaders,
      },
    })
  }

  get api() {
    return this.client
  }
}

type WithAccessToken<T> = (
  accessToken: string,
  arg: OpArgType<T>,
  init?: RequestInit,
) => ReturnType<TypedFetch<T>>

export function withAccessToken<T>(f: TypedFetch<T>) {
  const wrapped = (accessToken: string, arg: OpArgType<T>, init?: RequestInit) => {
    return f(arg, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    })
  }

  wrapped.Error = f.Error

  return wrapped as WithAccessToken<T> & {
    Error: typeof f.Error
  }
}

type WithAPIKey<T> = (
  apiKey: string,
  arg: OpArgType<T>,
  init?: RequestInit,
) => ReturnType<TypedFetch<T>>

export function withAPIKey<T>(f: TypedFetch<T>) {
  const wrapped = (apiKey: string, arg: OpArgType<T>, init?: RequestInit) => {
    return f(arg, {
      ...init,
      headers: {
        'X-API-KEY': apiKey,
        ...init?.headers,
      },
    })
  }

  wrapped.Error = f.Error

  return wrapped as WithAPIKey<T> & {
    Error: typeof f.Error
  }
}

export type { components, paths }
export { APIClient }
