import * as fetcher from 'openapi-typescript-fetch'
import type { OpArgType, TypedFetch } from 'openapi-typescript-fetch'

import { API_HOST } from '../constants'
import type { components, paths } from './schema.gen'
import { defaultHeaders } from './metadata'

const { Fetcher } = fetcher

const client = Fetcher.for<paths>()

type ClientType = typeof client

client.configure({
  baseUrl: API_HOST,
  init: {
    headers: defaultHeaders,
  },
})

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

export default client
export type { components, paths, ClientType }
