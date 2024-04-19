import * as fetcher from 'openapi-typescript-fetch'
import type { OpArgType, TypedFetch } from 'openapi-typescript-fetch'

import type { components, paths } from './schema.gen'
import { defaultHeaders } from './metadata'
import { DEBUG, DOMAIN, SECURE } from '../constants'

const { Fetcher } = fetcher

class APIClient {
  private client = Fetcher.for<paths>()

  constructor(private opts?: {
    secure?: boolean,
    domain?: string,
    debug?: boolean,
  }
  ) {
    this.client.configure({
      baseUrl: this.apiHost,
      init: {
        headers: defaultHeaders,
      },
    })
  }

  get secure() {
    return this.opts?.secure ?? SECURE
  }

  get domain() {
    return this.opts?.domain ?? DOMAIN
  }

  get debug() {
    return this.opts?.debug ?? DEBUG
  }

  get apiDomain() {
    return this.debug ? 'localhost:3000' : `api.${this.domain}`
  }

  get apiHost() {
    return `${this.secure && !this.debug ? 'https' : 'http'}://${this.apiDomain}`
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
