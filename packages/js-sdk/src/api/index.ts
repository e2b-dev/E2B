import * as fetcher from 'openapi-typescript-fetch'
import type { OpArgType, TypedFetch } from 'openapi-typescript-fetch'

import type { components, paths } from './schema.gen'
import { defaultHeaders } from './metadata'
import { DOMAIN, DEBUG } from '../constants'

const { Fetcher } = fetcher

export interface APIOpts {
  domain?: string
  debug?: boolean
}

class APIClient {
  private client = Fetcher.for<paths>()

  constructor(private opts?: APIOpts) {
    this.client.configure({
      baseUrl: this.apiHost,
      init: {
        headers: defaultHeaders,
      },
    })
  }


  get debug() {
    return this.opts?.debug ?? DEBUG
  }

  get domain() {
    return this.opts?.domain ?? DOMAIN
  }

  get apiDomain() {
    return this.debug ? 'localhost:3000' : `api.${this.domain}`
  }

  get apiHost() {
    return `${this.debug ? 'http' : 'https'}://${this.apiDomain}`
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
