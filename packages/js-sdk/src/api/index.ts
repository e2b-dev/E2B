import createClient, { FetchResponse } from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { defaultHeaders } from './metadata'
import { createApiFetch } from './http2'
import { ConnectionConfig } from '../connectionConfig'
import { AuthenticationError, RateLimitError, SandboxError } from '../errors'
import { createApiLogger } from '../logs'

/**
 * Map an API error code and message to the matching error class — the same
 * mapping {@link handleApiError} applies to HTTP responses, usable for error
 * objects embedded in response bodies (e.g. per-fork results).
 */
export function apiErrorFromCode(
  code: number,
  content: unknown,
  errorClass: new (
    message: string,
    stackTrace?: string
  ) => Error = SandboxError,
  stackTrace?: string,
  retryAfterHeader?: string | null
): Error {
  if (code === 401) {
    const message = 'Unauthorized, please check your credentials.'
    return new AuthenticationError(
      content ? `${message} - ${content}` : message
    )
  }

  if (code === 429) {
    const message = 'Rate limit exceeded, please try again later'
    return new RateLimitError(content ? `${message} - ${content}` : message, {
      retryAfterHeader,
    })
  }

  return new errorClass(`${code}: ${content}`, stackTrace)
}

export function handleApiError(
  response: FetchResponse<any, any, any>,
  errorClass: new (
    message: string,
    stackTrace?: string
  ) => Error = SandboxError,
  stackTrace?: string
): Error | undefined {
  // openapi-fetch leaves `error` undefined for non-2xx responses with
  // Content-Length: 0, so check the status instead
  if (response.response.ok) {
    return
  }

  const status = response.response.status
  const retryAfterHeader = response.response.headers?.get('Retry-After') ?? null
  if (status === 401 || status === 429) {
    return apiErrorFromCode(
      status,
      response.error?.message ?? response.error,
      errorClass,
      stackTrace,
      retryAfterHeader
    )
  }

  return apiErrorFromCode(
    status,
    response.error?.message || response.error || response.response.statusText,
    errorClass,
    stackTrace,
    retryAfterHeader
  )
}

/**
 * Client for interacting with the E2B API.
 */
class ApiClient {
  readonly api: ReturnType<typeof createClient<paths>>

  constructor(
    config: ConnectionConfig,
    opts: {
      requireApiKey?: boolean
    } = {}
  ) {
    if ((opts.requireApiKey ?? true) && !config.apiKey) {
      throw new AuthenticationError(
        'API key is required, please visit the API Keys tab at https://e2b.dev/dashboard?tab=keys to get your API key. ' +
          'You can either set the environment variable `E2B_API_KEY` ' +
          "or you can pass it directly to the sandbox like Sandbox.create({ apiKey: 'e2b_...' })"
      )
    }

    this.api = createClient<paths>({
      baseUrl: config.apiUrl,
      fetch: createApiFetch(config.proxy),
      // In HTTP 1.1, all connections are considered persistent unless declared otherwise
      // keepalive: true,
      headers: {
        ...defaultHeaders,
        ...(config.apiKey && { 'X-API-KEY': config.apiKey }),
        ...config.headers,
      },
      querySerializer: {
        array: {
          style: 'form',
          explode: false,
        },
      },
    })

    if (config.logger || config.requestSource === 'ci') {
      this.api.use(
        createApiLogger(
          config.logger ?? { error: (...args) => console.error(...args) },
          config.requestSource === 'ci'
        )
      )
    }
  }
}

export type { components, paths }
export { ApiClient }
